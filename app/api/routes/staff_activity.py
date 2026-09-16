from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import cast, String
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models import Application, Staff, StaffActivity

router = APIRouter(prefix="/staff-activity", tags=["staff-activity"])


def _client_ip(request: Request) -> str | None:
    # Railway/proxy forwards the original client address. Prefer the first forwarded IP.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45] or None
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()[:45] or None
    return request.client.host if request.client else None


def record_activity(db: Session, staff: Staff, event_type: str, application_id=None, metadata: dict | None = None, ip_address: str | None = None) -> StaffActivity:
    activity_metadata = dict(metadata or {})
    if ip_address:
        activity_metadata["ip_address"] = ip_address
    activity = StaffActivity(
        staff_id=staff.id,
        event_type=event_type[:50],
        application_id=application_id,
        activity_metadata=activity_metadata or None,
    )
    db.add(activity)
    return activity


def _application_id(value):
    if not value:
        return None
    try:
        from uuid import UUID
        return UUID(str(value))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid application_id")


@router.post("/heartbeat")
def heartbeat(request: Request, payload: dict | None = None, db: Session = Depends(get_db), current_user: Staff = Depends(get_current_user)):
    payload = payload or {}
    application_id = _application_id(payload.get("application_id"))
    if application_id and not db.query(Application).filter(Application.id == application_id).first():
        raise HTTPException(status_code=404, detail="Application not found")
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else None
    record_activity(db, current_user, "heartbeat", application_id, metadata, _client_ip(request))
    db.commit()
    return {"ok": True, "recorded_at": datetime.utcnow().isoformat()}


@router.post("/event")
def event(request: Request, payload: dict, db: Session = Depends(get_db), current_user: Staff = Depends(get_current_user)):
    event_type = str(payload.get("event_type") or "activity").strip().lower()
    allowed = {
        "session_start", "session_end", "lead_viewed", "leads_checked", "lead_status_changed",
        "lead_comment_added", "lead_reconciled", "driver_viewed", "payment_viewed",
        "heartbeat",
    }
    if event_type not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported activity event")

    application_id = _application_id(payload.get("application_id"))
    if application_id and not db.query(Application).filter(Application.id == application_id).first():
        raise HTTPException(status_code=404, detail="Application not found")

    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else None
    record_activity(db, current_user, event_type, application_id, metadata, _client_ip(request))
    db.commit()
    return {"ok": True}


@router.get("")
def list_activity(
    hours: int = 24,
    staff_id: str | None = None,
    ip: str | None = None,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user),
):
    if current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    hours = max(1, min(hours, 8760))
    since = datetime.utcnow() - timedelta(hours=hours)
    query = db.query(StaffActivity).filter(StaffActivity.created_at >= since)
    if staff_id:
        query = query.filter(StaffActivity.staff_id == staff_id)
    if ip:
        query = query.filter(cast(StaffActivity.activity_metadata["ip_address"].astext, String) == ip.strip())

    rows = query.order_by(StaffActivity.created_at.desc()).limit(5000).all()
    return [
        {
            "id": str(row.id),
            "staff_id": str(row.staff_id),
            "staff_name": row.staff.name if row.staff else None,
            "event_type": row.event_type,
            "application_id": str(row.application_id) if row.application_id else None,
            "metadata": row.activity_metadata,
            "ip_address": (row.activity_metadata or {}).get("ip_address"),
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]
