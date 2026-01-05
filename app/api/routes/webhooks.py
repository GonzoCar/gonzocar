from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import Application

router = APIRouter(prefix="/webhook", tags=["webhooks"])


@router.post("/fluent-forms")
async def fluent_forms_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Receive Fluent Forms submission from WordPress.
    Creates a new application with pending status.
    """
    # Get form data (could be JSON or form-encoded)
    content_type = request.headers.get("content-type", "")
    
    if "application/json" in content_type:
        form_data = await request.json()
    else:
        form_data = dict(await request.form())
    
    # Create application
    application = Application(
        status="pending",
        form_data=form_data
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    
    return {
        "status": "received",
        "application_id": str(application.id)
    }
