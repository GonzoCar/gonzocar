from app.api.routes.auth import router as auth_router
from app.api.routes.drivers import router as drivers_router
from app.api.routes.applications import router as applications_router
from app.api.routes.payments import router as payments_router
from app.api.routes.webhooks import router as webhooks_router
from app.api.routes.sms import router as sms_router

__all__ = [
    "auth_router",
    "drivers_router", 
    "applications_router",
    "payments_router",
    "webhooks_router",
    "sms_router",
]

