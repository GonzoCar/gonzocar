from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.security import hash_password, verify_password, create_access_token
from app.models import Staff, StaffActivity
from app.schemas import LoginRequest, TokenResponse, StaffCreate, StaffResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45] or None
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()[:45] or None
    return request.client.host if request.client else None


@router.post("/login", response_model=TokenResponse)
def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate staff and return JWT token, while recording the login IP."""
    staff = db.query(Staff).filter(Staff.email == credentials.email).first()

    if not staff or not verify_password(credentials.password, staff.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    access_token = create_access_token(data={"sub": str(staff.id)})
    db.add(StaffActivity(
        staff_id=staff.id,
        event_type="session_start",
        activity_metadata={"ip_address": _client_ip(request), "path": "/auth/login", "method": "POST"},
    ))
    db.commit()
    return TokenResponse(access_token=access_token)


@router.post("/register", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
def register(request: StaffCreate, db: Session = Depends(get_db)):
    """Register new staff member. First user becomes admin."""
    existing = db.query(Staff).filter(Staff.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    staff_count = db.query(Staff).count()
    role = "admin" if staff_count == 0 else "staff"

    staff = Staff(
        email=request.email,
        password_hash=hash_password(request.password),
        name=request.name,
        role=role
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)

    return staff


@router.get("/me", response_model=StaffResponse)
def get_me(current_user: Staff = Depends(get_current_user)):
    """Get current authenticated user."""
    return current_user


@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db), current_user: Staff = Depends(get_current_user)):
    """Record logout and let the client remove its JWT token."""
    db.add(StaffActivity(
        staff_id=current_user.id,
        event_type="session_end",
        activity_metadata={"ip_address": _client_ip(request), "path": "/auth/logout", "method": "POST"},
    ))
    db.commit()
    return {"message": "Logged out successfully"}
