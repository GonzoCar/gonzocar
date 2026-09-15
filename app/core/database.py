from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from .config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"sslmode": "require"} if "postgresql" in settings.database_url else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_system_settings(session: Session) -> None:
    """
    Ensure the `system_settings` table exists and has default rows.

    This exists as a defensive safeguard in case `init_db()` was run before
    the `SystemSetting` model was added, or the table was otherwise never
    created in the target database (e.g. production). It is safe to call on
    every startup.
    """
    # Import here to avoid circular imports (models imports Base from this module).
    from app.models.models import SystemSetting

    try:
        table_exists = inspect(engine).has_table(SystemSetting.__tablename__)
    except Exception:
        table_exists = False

    if not table_exists:
        SystemSetting.__table__.create(bind=engine, checkfirst=True)

    try:
        has_rows = session.query(SystemSetting).first() is not None
    except Exception:
        # Table may still not be visible in this session/transaction; bail out safely.
        session.rollback()
        return

    if not has_rows:
        default_row = SystemSetting(key="reminder_mode", value="manual")
        session.add(default_row)
        session.commit()
