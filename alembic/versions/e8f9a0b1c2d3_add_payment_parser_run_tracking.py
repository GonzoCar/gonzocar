"""add payment parser run tracking

Revision ID: e8f9a0b1c2d3
Revises: c9d8e7f6a5b4
Create Date: 2026-04-17 15:24:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, None] = "c9d8e7f6a5b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payment_parser_runs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("triggered_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("lookback_hours", sa.Integer(), nullable=True),
        sa.Column("max_results", sa.Integer(), nullable=True),
        sa.Column("trigger_source", sa.String(length=50), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_payment_parser_runs_triggered_at",
        "payment_parser_runs",
        ["triggered_at"],
        unique=False,
    )
    op.create_index(
        "ix_payment_parser_runs_success_triggered_at",
        "payment_parser_runs",
        ["success", "triggered_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_payment_parser_runs_success_triggered_at", table_name="payment_parser_runs")
    op.drop_index("ix_payment_parser_runs_triggered_at", table_name="payment_parser_runs")
    op.drop_table("payment_parser_runs")
