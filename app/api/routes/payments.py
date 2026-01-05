from fastapi import APIRouter

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/unrecognized")
def list_unrecognized():
    """List unrecognized payments."""
    return []
