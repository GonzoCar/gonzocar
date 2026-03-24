"""
System status endpoint for checking service health.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
import os
import httpx

from app.api.deps import get_db, get_current_user
from app.models import Staff
from app.services.gmail_service import GmailService

router = APIRouter(prefix="/status", tags=["status"])


@router.get("")
def get_system_status(
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """Get system status for all integrations."""
    status = {
        "database": check_database(db),
        "openphone": check_openphone(),
        "gmail": check_gmail(),
    }
    return status


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
