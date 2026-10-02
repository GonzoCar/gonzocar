"""Seed the reminder mode to manual.

Revision ID: c4e6f8a1b2d3
Revises: 7b8c9d0e1f2a
Create Date: 2026-10-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4e6f8a1b2d3"
down_revision: Union[str, None] = "7b8c9d0e1f2a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Manual is the safe default and explicitly disables the old automatic
    # reminder behavior for existing deployments. Staff can opt into automatic
    # reminders from Settings after deployment.
    op.execute(
        sa.text(
            """
            INSERT INTO system_settings (id, key, value, updated_at)
            VALUES (gen_random_uuid(), 'reminder_mode', 'manual', NOW())
            ON CONFLICT (key)
            DO UPDATE SET value = 'manual', updated_at = NOW()
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM system_settings WHERE key = 'reminder_mode'"
        )
    )
