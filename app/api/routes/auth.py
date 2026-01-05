from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.security import hash_password, verify_password, create_access_token
from app.models import Staff
from app.schemas import LoginRequest, TokenResponse, StaffCreate, StaffResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate staff and return JWT token."""
    staff = db.query(Staff).filter(Staff.email == request.email).first()
    
    if not staff or not verify_password(request.password, staff.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    access_token = create_access_token(data={"sub": str(staff.id)})
    return TokenResponse(access_token=access_token)


@router.post("/register", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
def register(request: StaffCreate, db: Session = Depends(get_db)):
    """Register new staff member. First user becomes admin."""
    # Check if email already exists
    existing = db.query(Staff).filter(Staff.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # First user is admin
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
def logout():
    """Logout (client-side token removal)."""
    return {"message": "Logged out successfully"}
