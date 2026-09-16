"""add staff activity audit table

Revision ID: 9f4c2a7b1d6e
Revises: f1a2b3c4d5e6
Create Date: 2026-09-16 02:15:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "9f4c2a7b1d6e"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "staff_activity",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"]),
        sa.ForeignKeyConstraint(["staff_id"], ["staff.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_staff_activity_staff_created_at", "staff_activity", ["staff_id", "created_at"], unique=False)
    op.create_index("ix_staff_activity_application_created_at", "staff_activity", ["application_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_staff_activity_application_created_at", table_name="staff_activity")
    op.drop_index("ix_staff_activity_staff_created_at", table_name="staff_activity")
    op.drop_table("staff_activity")
