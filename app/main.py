from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, gmail_oauth, drivers, applications, payments, webhooks, status, sms

app = FastAPI(
    title="Gonzo Core",
    description="Backend system for GonzoFleet",
    version="0.1.0"
)

# CORS for admin panel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth.router, prefix="/api")
app.include_router(gmail_oauth.router, prefix="/api")
app.include_router(drivers.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(status.router, prefix="/api")
app.include_router(sms.router, prefix="/api")
app.include_router(webhooks.router)  # No prefix, webhook at root

# Google OAuth callback at the root path, matching the registered redirect URI.
app.add_api_route(
    "/oauth/callback",
    gmail_oauth.gmail_oauth_callback,
    methods=["GET", "POST"],
    tags=["gmail-oauth"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
