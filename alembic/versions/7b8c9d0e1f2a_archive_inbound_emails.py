"""archive inbound gmail messages

Revision ID: 7b8c9d0e1f2a
Revises: 6a7b8c9d0e1f
Create Date: 2026-09-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "7b8c9d0e1f2a"
down_revision = "6a7b8c9d0e1f"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "inbound_emails",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gmail_id", sa.String(length=255), nullable=False),
        sa.Column("sender", sa.String(length=500), nullable=True),
        sa.Column("recipients", sa.Text(), nullable=True),
        sa.Column("subject", sa.String(length=1000), nullable=True),
        sa.Column("received_at", sa.DateTime(), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=False, server_default="unknown"),
        sa.Column("parse_status", sa.String(length=50), nullable=False, server_default="unprocessed"),
        sa.Column("raw_email", sa.LargeBinary(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("gmail_id"),
    )
    op.create_index("ix_inbound_emails_gmail_id", "inbound_emails", ["gmail_id"], unique=True)
    op.create_index("ix_inbound_emails_received_at", "inbound_emails", ["received_at"], unique=False)
    op.create_index("ix_inbound_emails_category_status", "inbound_emails", ["category", "parse_status"], unique=False)

def downgrade() -> None:
    op.drop_index("ix_inbound_emails_category_status", table_name="inbound_emails")
    op.drop_index("ix_inbound_emails_received_at", table_name="inbound_emails")
    op.drop_index("ix_inbound_emails_gmail_id", table_name="inbound_emails")
    op.drop_table("inbound_emails")
