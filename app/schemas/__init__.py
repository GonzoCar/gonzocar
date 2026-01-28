from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime


# Auth
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class StaffBase(BaseModel):
    email: EmailStr
    name: str


class StaffCreate(StaffBase):
    password: str


class StaffResponse(StaffBase):
    id: UUID
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


# Drivers
class DriverBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    billing_type: str = "daily"
    billing_rate: float


class DriverCreate(DriverBase):
    pass


class DriverUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    billing_type: Optional[str] = None
    billing_rate: Optional[float] = None
    billing_active: Optional[bool] = None


class DriverResponse(DriverBase):
    id: UUID
    billing_active: bool
    created_at: datetime
    updated_at: datetime
    balance: Optional[float] = None
    application_info: Optional[dict] = None

    class Config:
        from_attributes = True


# Applications
class ApplicationCreate(BaseModel):
    form_data: dict


class ApplicationStatusUpdate(BaseModel):
    status: str
    message: Optional[str] = None


class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: UUID
    content: str
    staff_id: UUID
    staff_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApplicationResponse(BaseModel):
    id: UUID
    status: str
    form_data: dict
    driver_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    comments: list[CommentResponse] = []

    class Config:
        from_attributes = True


# Aliases
class AliasCreate(BaseModel):
    alias_type: str
    alias_value: str


class AliasResponse(BaseModel):
    id: UUID
    alias_type: str
    alias_value: str
    created_at: datetime

    class Config:
        from_attributes = True


# Payments
class PaymentAssign(BaseModel):
    driver_id: UUID
    create_alias: bool = True


class PaymentResponse(BaseModel):
    id: UUID
    source: str
    amount: float
    sender_name: Optional[str] = None
    sender_identifier: Optional[str] = None
    transaction_id: Optional[str] = None
    memo: Optional[str] = None
    received_at: Optional[datetime] = None
    matched: bool
    driver_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Ledger
class LedgerResponse(BaseModel):
    id: UUID
    type: str
    amount: float
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
