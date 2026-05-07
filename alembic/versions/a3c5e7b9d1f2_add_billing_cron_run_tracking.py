"""add billing cron run tracking

Revision ID: a3c5e7b9d1f2
Revises: e8f9a0b1c2d3
Create Date: 2026-05-07 00:10:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a3c5e7b9d1f2"
down_revision: Union[str, None] = "e8f9a0b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "billing_cron_runs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("triggered_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("trigger_source", sa.String(length=50), nullable=False),
        sa.Column("result_status", sa.String(length=50), nullable=True),
        sa.Column("within_charge_window", sa.Boolean(), nullable=True),
        sa.Column("active_drivers", sa.Integer(), nullable=True),
        sa.Column("daily_debits", sa.Integer(), nullable=True),
        sa.Column("weekly_debits", sa.Integer(), nullable=True),
        sa.Column("late_drivers", sa.Integer(), nullable=True),
        sa.Column("sms_sent", sa.Integer(), nullable=True),
        sa.Column("sms_failed", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_billing_cron_runs_triggered_at",
        "billing_cron_runs",
        ["triggered_at"],
        unique=False,
    )
    op.create_index(
        "ix_billing_cron_runs_success_triggered_at",
        "billing_cron_runs",
        ["success", "triggered_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_billing_cron_runs_success_triggered_at", table_name="billing_cron_runs")
    op.drop_index("ix_billing_cron_runs_triggered_at", table_name="billing_cron_runs")
    op.drop_table("billing_cron_runs")
