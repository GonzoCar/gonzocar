from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from uuid import UUID

from app.api.deps import get_db, get_current_user
from app.models import Driver, Ledger, Alias, Staff
from app.schemas import (
    DriverCreate, DriverUpdate, DriverResponse,
    AliasCreate, AliasResponse, LedgerResponse
)

router = APIRouter(prefix="/drivers", tags=["drivers"])


@router.get("", response_model=list[DriverResponse])
def list_drivers(
    skip: int = 0,
    limit: int = 100,
    billing_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """List all drivers with optional filters."""
    query = db.query(Driver)
    
    if billing_active is not None:
        query = query.filter(Driver.billing_active == billing_active)
    
    drivers = query.offset(skip).limit(limit).all()
    
    # Calculate balance for each driver
    result = []
    for driver in drivers:
        driver_dict = {
            "id": driver.id,
            "first_name": driver.first_name,
            "last_name": driver.last_name,
            "email": driver.email,
            "phone": driver.phone,
            "billing_type": driver.billing_type.value,
            "billing_rate": float(driver.billing_rate),
            "billing_active": driver.billing_active,
            "created_at": driver.created_at,
            "updated_at": driver.updated_at,
            "balance": _calculate_balance(db, driver.id)
        }
        result.append(driver_dict)
    
    return result


@router.post("", response_model=DriverResponse, status_code=status.HTTP_201_CREATED)
def create_driver(
    request: DriverCreate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """Create a new driver."""
    driver = Driver(
        first_name=request.first_name,
        last_name=request.last_name,
        email=request.email,
        phone=request.phone,
        billing_type=request.billing_type,
        billing_rate=request.billing_rate
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)
    
    return {
        **driver.__dict__,
        "billing_type": driver.billing_type.value,
        "billing_rate": float(driver.billing_rate),
        "balance": 0.0
    }


@router.get("/{driver_id}", response_model=DriverResponse)
def get_driver(
    driver_id: UUID,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """Get a single driver by ID."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Get linked application info (full profile)
    # We prioritize 'approved' applications, or take the latest one
    from app.models import Application
    application = db.query(Application).filter(
        Application.driver_id == driver_id
    ).order_by(Application.created_at.desc()).first()
    
    application_info = application.form_data if application else None

    return {
        **driver.__dict__,
        "billing_type": driver.billing_type.value,
        "billing_rate": float(driver.billing_rate),
        "balance": _calculate_balance(db, driver.id),
        "application_info": application_info
    }


@router.patch("/{driver_id}", response_model=DriverResponse)
def update_driver(
    driver_id: UUID,
    request: DriverUpdate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """Update a driver's profile."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(driver, field, value)
    
    db.commit()
    db.refresh(driver)
    
    return {
        **driver.__dict__,
        "billing_type": driver.billing_type.value,
        "billing_rate": float(driver.billing_rate),
        "balance": _calculate_balance(db, driver.id)
    }


@router.patch("/{driver_id}/billing", response_model=DriverResponse)
def toggle_billing(
    driver_id: UUID,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """Toggle billing active status for a driver."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    driver.billing_active = not driver.billing_active
    db.commit()
    db.refresh(driver)
    
    return {
        **driver.__dict__,
        "billing_type": driver.billing_type.value,
        "billing_rate": float(driver.billing_rate),
        "balance": _calculate_balance(db, driver.id)
    }


# Aliases
@router.get("/{driver_id}/aliases", response_model=list[AliasResponse])
def list_aliases(
    driver_id: UUID,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """List all aliases for a driver."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    return driver.aliases


@router.post("/{driver_id}/aliases", response_model=AliasResponse, status_code=status.HTTP_201_CREATED)
def create_alias(
    driver_id: UUID,
    request: AliasCreate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """Add a new alias for a driver."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Check if alias already exists
    existing = db.query(Alias).filter(
        Alias.alias_type == request.alias_type,
        Alias.alias_value == request.alias_value
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Alias already exists")
    
    alias = Alias(
        driver_id=driver_id,
        alias_type=request.alias_type,
        alias_value=request.alias_value
    )
    db.add(alias)
    db.commit()
    db.refresh(alias)
    
    return alias


@router.delete("/{driver_id}/aliases/{alias_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alias(
    driver_id: UUID,
    alias_id: UUID,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """Delete an alias."""
    alias = db.query(Alias).filter(
        Alias.id == alias_id,
        Alias.driver_id == driver_id
    ).first()
    if not alias:
        raise HTTPException(status_code=404, detail="Alias not found")
    
    db.delete(alias)
    db.commit()


# Ledger
@router.get("/{driver_id}/ledger", response_model=list[LedgerResponse])
def get_ledger(
    driver_id: UUID,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """Get ledger entries for a driver."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    entries = db.query(Ledger).filter(
        Ledger.driver_id == driver_id
    ).order_by(Ledger.created_at.desc()).offset(skip).limit(limit).all()
    
    return entries


def _calculate_balance(db: Session, driver_id: UUID) -> float:
    """Calculate driver balance (credits - debits)."""
    from sqlalchemy import case
    
    result = db.query(
        func.sum(
            case(
                (Ledger.type == "credit", Ledger.amount),
                else_=-Ledger.amount
            )
        )
    ).filter(Ledger.driver_id == driver_id).scalar()
    
    return float(result) if result else 0.0

