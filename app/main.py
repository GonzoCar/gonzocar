from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import models before touching Base.metadata so all tables are registered.
from app import models  # noqa: F401
from app.core.database import Base, engine, SessionLocal, ensure_system_settings
from app.api.routes import auth, drivers, applications, payments, webhooks, status, sms

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
app.include_router(drivers.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(status.router, prefix="/api")
app.include_router(sms.router, prefix="/api")
app.include_router(webhooks.router)  # No prefix, webhook at root


@app.on_event("startup")
def on_startup() -> None:
    """
    Ensure the database schema is consistent with the ORM models on startup.

    `Base.metadata.create_all()` only creates tables that are missing; it will
    not touch tables that already exist. This guards against situations where
    a new model (e.g. `SystemSetting`) was added after the database was first
    initialized, which would otherwise leave the table missing in production.
    """
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        ensure_system_settings(db)
    finally:
        db.close()


@app.get("/health")
async def health_check():
    return {"status": "ok"}
