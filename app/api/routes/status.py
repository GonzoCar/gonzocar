"""
System status endpoint for checking service health.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
import os
import httpx

from app.api.deps import get_db, get_current_user
from app.core.config import get_settings
from app.models import PaymentParserRun, Staff
from app.services.gmail_service import GmailService
from scripts.parse_payments import (
    compute_backfill_hours,
    get_last_payment_created_at,
    run_with_gmail,
)

router = APIRouter(prefix="/status", tags=["status"])
PARSER_INTERVAL_MINUTES = 5
PARSER_GRACE_MINUTES = 2
PARSER_MISS_HISTORY_LIMIT = 20
PARSER_MISS_SCAN_LIMIT = 5000


@router.get("")
def get_system_status(
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """Get system status for all integrations."""
    status_payload = {
        "database": check_database(db),
        "openphone": check_openphone(),
        "gmail": check_gmail(),
        "payment_parser": check_payment_parser_health(db),
    }
    return status_payload


@router.post("/run-payment-parser")
def run_payment_parser(
    authorization: str | None = Header(default=None),
    x_cron_token: str | None = Header(default=None),
    x_cron_source: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """
    Trigger payment parser from Railway cron function.
    Protected by INTERNAL_CRON_TOKEN.
    """
    settings = get_settings()
    expected_token = (settings.internal_cron_token or "").strip()
    if not expected_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal cron token not configured",
        )

    provided_token = (x_cron_token or "").strip()
    if not provided_token and authorization:
        auth_value = authorization.strip()
        if auth_value.lower().startswith("bearer "):
            provided_token = auth_value[7:].strip()

    if provided_token != expected_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid cron token")

    last_created_at = get_last_payment_created_at(db)

    hours = 1
    max_results = 200
    if last_created_at:
        hours = compute_backfill_hours(last_created_at, min_hours=hours, safety_hours=1)
        max_results = 2000

    trigger_source = (x_cron_source or "railway-cron").strip()[:50] or "railway-cron"
    parser_run = PaymentParserRun(
        triggered_at=datetime.utcnow(),
        success=False,
        lookback_hours=hours,
        max_results=max_results,
        trigger_source=trigger_source,
    )
    db.add(parser_run)
    db.commit()
    db.refresh(parser_run)

    try:
        success = run_with_gmail(hours=hours, max_results=max_results)
        parser_run.finished_at = datetime.utcnow()

        if not success:
            parser_run.success = False
            parser_run.error_message = "Payment parser run failed"
            db.commit()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Payment parser run failed")

        parser_run.success = True
        parser_run.error_message = None
        db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        parser_run.finished_at = datetime.utcnow()
        parser_run.success = False
        parser_run.error_message = str(exc)[:500]
        db.commit()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Payment parser run failed")

    return {
        "ok": True,
        "run_id": str(parser_run.id),
        "executed_at": datetime.utcnow().isoformat(),
        "lookback_hours": hours,
        "max_results": max_results,
        "last_payment_created_at": last_created_at.isoformat() if last_created_at else None,
    }


def check_database(db: Session) -> dict:
    """Check database connection."""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "message": "Connected"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def check_openphone() -> dict:
    """Check OpenPhone API reachability and credentials."""
    api_key = (os.getenv("OPENPHONE_API_KEY") or "").strip()
    phone = (os.getenv("OPENPHONE_PHONE_NUMBER") or "").strip()

    if len(api_key) <= 10:
        return {"status": "error", "message": "API key not set"}

    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.get(
                "https://api.openphone.com/v1/phone-numbers",
                headers={"Authorization": api_key},
            )
    except Exception as exc:
        return {"status": "warning", "message": f"OpenPhone unreachable: {exc}"}

    if response.status_code in {401, 403}:
        return {"status": "error", "message": "Invalid OpenPhone API key"}
    if response.status_code >= 500:
        return {"status": "warning", "message": f"OpenPhone API unavailable ({response.status_code})"}
    if response.status_code != 200:
        return {"status": "warning", "message": f"OpenPhone API returned {response.status_code}"}

    if not phone:
        return {"status": "ok", "message": "Connected"}

    try:
        payload = response.json()
    except Exception:
        return {"status": "warning", "message": "Connected (phone validation skipped)"}

    records = payload.get("data") if isinstance(payload, dict) else []
    if not isinstance(records, list):
        return {"status": "warning", "message": "Connected (unexpected response format)"}

    target_digits = "".join(ch for ch in phone if ch.isdigit())
    phone_found = False
    for record in records:
        if not isinstance(record, dict):
            continue
        candidate = record.get("phoneNumber") or record.get("number") or ""
        candidate_digits = "".join(ch for ch in str(candidate) if ch.isdigit())
        if candidate_digits == target_digits:
            phone_found = True
            break

    if phone_found:
        return {"status": "ok", "message": "Connected"}
    return {"status": "warning", "message": "Connected (configured phone not found)"}


def check_gmail() -> dict:
    """Check Gmail API auth and mailbox connectivity."""
    # Check env variables first (production)
    creds_env = os.getenv("GMAIL_CREDENTIALS")
    token_env = os.getenv("GMAIL_TOKEN")

    # Check if credentials files exist (local)
    creds_exists = os.path.exists("credentials.json")
    token_exists = os.path.exists("token.json")

    if not ((creds_env and token_env) or (creds_exists and token_exists)):
        if creds_env or creds_exists:
            return {"status": "warning", "message": "Needs authorization"}
        return {"status": "error", "message": "Credentials not found"}

    try:
        gmail = GmailService()
        profile = gmail.service.users().getProfile(userId="me").execute()
        connected_as = profile.get("emailAddress")
        if connected_as:
            return {"status": "ok", "message": f"Connected ({connected_as})"}
        return {"status": "ok", "message": "Connected"}
    except Exception as exc:
        return {"status": "error", "message": f"Gmail auth failed: {str(exc)[:180]}"}


def _compute_parser_miss_events(
    run_times: list[datetime],
    now: datetime,
    interval_minutes: int,
    grace_minutes: int,
) -> tuple[list[dict], int]:
    interval = timedelta(minutes=interval_minutes)
    grace = timedelta(minutes=grace_minutes)
    events: list[dict] = []
    total_missed = 0

    normalized_times: list[datetime] = []
    for value in run_times:
        if not value:
            continue
        normalized_times.append(value.replace(tzinfo=None) if value.tzinfo else value)

    def inspect_gap(previous: datetime, current: datetime | None):
        nonlocal total_missed
        expected = previous + interval
        missed_count = 0
        first_missed: datetime | None = None
        scans = 0

        reference = current if current is not None else now
        while expected + grace < reference and scans < PARSER_MISS_SCAN_LIMIT:
            if first_missed is None:
                first_missed = expected
            missed_count += 1
            scans += 1
            expected += interval

        if missed_count == 0 or first_missed is None:
            return

        total_missed += missed_count
        delay_minutes = round((reference - previous).total_seconds() / 60, 1)
        events.append(
            {
                "missed_at": first_missed.isoformat(),
                "recovered_at": current.isoformat() if current else None,
                "missed_intervals": missed_count,
                "delay_minutes": delay_minutes,
            }
        )

    for idx in range(1, len(normalized_times)):
        inspect_gap(normalized_times[idx - 1], normalized_times[idx])

    if normalized_times:
        inspect_gap(normalized_times[-1], None)

    return events, total_missed


def check_payment_parser_health(db: Session) -> dict:
    now = datetime.utcnow()
    try:
        runs = (
            db.query(PaymentParserRun)
            .order_by(PaymentParserRun.triggered_at.asc())
            .all()
        )
    except SQLAlchemyError:
        return {
            "status": "warning",
            "message": "Parser tracking table is not initialized",
            "tracking_started_at": now.isoformat(),
            "expected_interval_minutes": PARSER_INTERVAL_MINUTES,
            "grace_minutes": PARSER_GRACE_MINUTES,
            "last_run_at": None,
            "last_success_at": None,
            "last_error": None,
            "total_runs": 0,
            "failed_runs": 0,
            "total_missed_windows": 0,
            "currently_late": False,
            "current_delay_minutes": 0,
            "miss_history": [],
        }

    total_runs = len(runs)
    failed_runs = sum(1 for run in runs if not run.success)
    run_times = [run.triggered_at for run in runs if run.triggered_at]
    events, total_missed = _compute_parser_miss_events(
        run_times=run_times,
        now=now,
        interval_minutes=PARSER_INTERVAL_MINUTES,
        grace_minutes=PARSER_GRACE_MINUTES,
    )

    last_run = runs[-1] if runs else None
    last_success = next((run for run in reversed(runs) if run.success), None)
    ongoing_event = events[-1] if events and events[-1].get("recovered_at") is None else None

    if total_runs == 0:
        status_value = "warning"
        message = "Tracking started. Waiting for first parser run."
    elif last_run and not last_run.success:
        status_value = "error"
        message = "Last parser run failed"
    elif ongoing_event:
        status_value = "error"
        message = f"Parser delayed by {ongoing_event['delay_minutes']} min"
    elif total_missed > 0:
        status_value = "warning"
        message = f"{total_missed} missed cron windows recorded"
    elif failed_runs > 0:
        status_value = "warning"
        message = f"{failed_runs} failed runs in history"
    else:
        status_value = "ok"
        message = "Running on schedule"

    return {
        "status": status_value,
        "message": message,
        "tracking_started_at": run_times[0].isoformat() if run_times else now.isoformat(),
        "expected_interval_minutes": PARSER_INTERVAL_MINUTES,
        "grace_minutes": PARSER_GRACE_MINUTES,
        "last_run_at": last_run.triggered_at.isoformat() if last_run else None,
        "last_success_at": last_success.triggered_at.isoformat() if last_success else None,
        "last_error": last_run.error_message if last_run and not last_run.success else None,
        "total_runs": total_runs,
        "failed_runs": failed_runs,
        "total_missed_windows": total_missed,
        "currently_late": ongoing_event is not None,
        "current_delay_minutes": ongoing_event["delay_minutes"] if ongoing_event else 0,
        "miss_history": list(reversed(events[-PARSER_MISS_HISTORY_LIMIT:])),
    }
