"""
SMS Routes - Send SMS via OpenPhone API
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_staff
from app.models.models import Staff, SmsLog
from app.services.openphone import openphone

router = APIRouter(prefix="/sms", tags=["sms"])


class SendSmsRequest(BaseModel):
    phone: str
    message: str


class SendSmsResponse(BaseModel):
    success: bool
    message_id: str | None = None
    error: str | None = None


@router.post("/send", response_model=SendSmsResponse)
async def send_sms(
    request: SendSmsRequest,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_staff),
):
    """Send an SMS message via OpenPhone."""
    
    result = await openphone.send_sms(request.phone, request.message)
    
    # Log the SMS
    sms_log = SmsLog(
        phone=request.phone,
        message=request.message,
        status="sent" if result.success else "failed",
        openphone_response={
            "message_id": result.message_id,
            "error": result.error,
        }
    )
    db.add(sms_log)
    db.commit()
    
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error or "Failed to send SMS")
    
    return SendSmsResponse(
        success=True,
        message_id=result.message_id,
    )
