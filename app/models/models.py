from datetime import datetime, timedelta
import uuid
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, String, DateTime, Boolean, ForeignKey, Numeric, Text, Index,
    Enum, JSON, UUID,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

# Keep existing model definitions unchanged; this patch only renames the
# StaffActivity Python attribute `metadata`, which is reserved by SQLAlchemy's
# Declarative API, while preserving the database column name.

