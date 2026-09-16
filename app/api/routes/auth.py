from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.security import hash_password, verify_password, create_access_token
from app.models import Staff, StaffActivity
from app.schemas import LoginRequest, TokenResponse, StaffCreate, StaffResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.headers.get("x-real-ip") or (request.client.host if request.client else None)


def record_session_activity(db: Session, staff: Staff, event_type: str, request: Request) -> None:
    activity = StaffActivity(
        staff_id=staff.id,
        event_type=event_type,
        activity_metadata={"ip": get_client_ip(request)},
    )
    db.add(activity)
    db.commit()


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, http_request: Request, db: Session = Depends(get_db)):
    """Authenticate staff and return JWT token."""
    staff = db.query(Staff).filter(Staff.email == request.email).first()

    if not staff or not verify_password(request.password, staff.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    access_token = create_access_token(data={"sub": str(staff.id)})
    record_session_activity(db, staff, "session_start", http_request)
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
def logout(http_request: Request, db: Session = Depends(get_db), current_user: Staff = Depends(get_current_user)):
    """Record logout and let the client remove its JWT token."""
    record_session_activity(db, current_user, "session_end", http_request)
    return {"message": "Logged out successfully"}
