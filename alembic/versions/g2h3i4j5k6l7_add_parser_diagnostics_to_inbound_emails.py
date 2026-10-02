"""add parser diagnostics to inbound emails

Revision ID: g2h3i4j5k6l7
Revises: f1a2b3c4d5e6
Create Date: 2026-10-02
"""
from alembic import op
import sqlalchemy as sa

revision = "g2h3i4j5k6l7"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("inbound_emails", sa.Column("detected_source", sa.String(length=50), nullable=True))
    op.add_column("inbound_emails", sa.Column("parser_attempts", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("inbound_emails", sa.Column("last_parsed_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("inbound_emails", "last_parsed_at")
    op.drop_column("inbound_emails", "parser_attempts")
    op.drop_column("inbound_emails", "detected_source")
