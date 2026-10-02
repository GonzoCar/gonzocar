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
    op.add_column("payment_parser_runs", sa.Column("found_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("payment_parser_runs", sa.Column("new_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("payment_parser_runs", sa.Column("matched_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("payment_parser_runs", sa.Column("unmatched_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("payment_parser_runs", sa.Column("duplicate_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("payment_parser_runs", sa.Column("unparsed_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("payment_parser_runs", sa.Column("ignored_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("payment_parser_runs", sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("inbound_emails", "last_parsed_at")
    op.drop_column("inbound_emails", "parser_attempts")
    op.drop_column("payment_parser_runs", "failed_count")
    op.drop_column("payment_parser_runs", "ignored_count")
    op.drop_column("payment_parser_runs", "unparsed_count")
    op.drop_column("payment_parser_runs", "duplicate_count")
    op.drop_column("payment_parser_runs", "unmatched_count")
    op.drop_column("payment_parser_runs", "matched_count")
    op.drop_column("payment_parser_runs", "new_count")
    op.drop_column("payment_parser_runs", "found_count")
    op.drop_column("inbound_emails", "detected_source")
