from typing import Generator
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models import Staff, StaffActivity

security = HTTPBearer(auto_error=True, scheme_name="Bearer")


def get_db() -> Generator:
    """Database session dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _activity_for_request(request: Request) -> str:
    path = request.url.path
    method = request.method.upper()
    if path.startswith("/api/applications/") and path.endswith("/status") and method == "PATCH":
        return "lead_status_changed"
    if path.startswith("/api/applications/") and path.endswith("/comment") and method == "POST":
        return "lead_comment_added"
    if path.startswith("/api/applications/"):
        return "lead_viewed"
    if path.startswith("/api/applications"):
        return "leads_checked"
    if path.startswith("/api/drivers"):
        return "driver_activity"
    if path.startswith("/api/payments"):
        return "payment_activity"
    if path.startswith("/api/status"):
        return "system_check"
    return "api_activity"


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Staff:
    """Get current authenticated staff user from JWT token and audit the request."""
    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    staff_id = payload.get("sub")
    if staff_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if staff is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    application_id = None
    if request.url.path.startswith("/api/applications/"):
        from uuid import UUID
        parts = request.url.path.split("/")
        if len(parts) > 3:
            try:
                application_id = UUID(parts[3])
            except ValueError:
                application_id = None

    activity = StaffActivity(
        staff_id=staff.id,
        event_type=_activity_for_request(request),
        application_id=application_id,
        metadata={
            "method": request.method,
            "path": request.url.path,
        },
    )
    db.add(activity)
    db.commit()

    return staff


def get_current_admin(current_user: Staff = Depends(get_current_user)) -> Staff:
    """Require admin role."""
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
