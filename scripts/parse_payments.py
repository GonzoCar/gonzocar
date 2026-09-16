#!/usr/bin/env python3
"""
Cron Job: Parse Payment Emails

Runs every 5 minutes to fetch payment emails, parse them, store raw payments,
match drivers, and create ledger credits.
"""

import sys
import os
import math
import re
from datetime import datetime
from uuid import uuid4

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.models import PaymentRaw, Alias, Ledger, Driver
from app.services.gmail_parser import parse_email, ParsedPayment


def get_db() -> Session:
    return SessionLocal()


def is_duplicate(db: Session, source: str, transaction_id: str, gmail_id: str = None) -> bool:
    if _is_reliable_transaction_id(transaction_id):
        existing = db.query(PaymentRaw).filter(
            PaymentRaw.source == source,
            PaymentRaw.transaction_id == transaction_id
        ).first()
        if existing:
            return True
    if gmail_id:
        existing_by_gmail = db.query(PaymentRaw).filter(PaymentRaw.gmail_id == gmail_id).first()
        if existing_by_gmail:
            return True
    return False


def _is_reliable_transaction_id(transaction_id: str | None) -> bool:
    if not transaction_id:
        return False
    normalized = transaction_id.strip()
    if not normalized or normalized.lower() in {"none", "n/a", "na"} or re.fullmatch(r"0+", normalized):
        return False
    return True


def find_driver_by_alias(db: Session, sender_name: str, sender_identifier: str) -> Driver:
    candidates = []
    if sender_name:
        candidates.append(sender_name.strip())
    if sender_identifier:
        candidates.append(sender_identifier.strip())
    for candidate in candidates:
        alias = db.query(Alias).filter(func.lower(Alias.alias_value) == candidate.lower()).first()
        if alias:
            return db.query(Driver).filter(Driver.id == alias.driver_id).first()
    return None


def store_payment(db: Session, payment: ParsedPayment, gmail_id: str = None) -> PaymentRaw:
    if is_duplicate(db, payment.source, payment.transaction_id, gmail_id):
        return None

    driver = find_driver_by_alias(db, payment.sender_name, payment.sender_identifier)
    payment_raw = PaymentRaw(
        id=uuid4(), source=payment.source, sender_name=payment.sender_name,
        sender_identifier=payment.sender_identifier, amount=payment.amount,
        transaction_id=payment.transaction_id, memo=payment.memo,
        received_at=payment.received_at, gmail_id=gmail_id,
        driver_id=driver.id if driver else None, matched=driver is not None
    )
    db.add(payment_raw)
    db.flush()

    if driver:
        db.add(Ledger(
            id=uuid4(), driver_id=driver.id, type='credit', amount=payment.amount,
            description=f"{payment.source.upper()} payment from {payment.sender_name}",
            reference_id=str(payment_raw.id), created_at=datetime.utcnow()
        ))
    return payment_raw


def process_email(db: Session, raw_email: bytes, gmail_id: str = None) -> tuple[bool, str]:
    payment = parse_email(raw_email)
    if not payment:
        return False, "unparsed"
    result = store_payment(db, payment, gmail_id)
    if result is None:
        return False, "duplicate"
    if result.matched:
        return True, "matched"
    return True, "unmatched"


def get_last_payment_created_at(db: Session):
    row = db.query(PaymentRaw.created_at).order_by(PaymentRaw.created_at.desc()).first()
    return row[0] if row else None


def compute_backfill_hours(last_created_at: datetime, min_hours: int = 1, safety_hours: int = 1) -> int:
    if not last_created_at:
        return max(1, min_hours)
    now = datetime.utcnow()
    reference = last_created_at.replace(tzinfo=None) if last_created_at.tzinfo is not None else last_created_at
    delta_hours = max(0.0, (now - reference).total_seconds() / 3600.0)
    return max(min_hours, math.ceil(delta_hours) + max(0, safety_hours))


def run_with_gmail(hours: int = 1, max_results: int = 50) -> bool:
    try:
        from app.services.gmail_service import GmailService
    except ImportError as e:
        print(f"Gmail service import error: {e}")
        return False

    has_env_credentials = bool(os.getenv('GMAIL_CREDENTIALS')) and bool(os.getenv('GMAIL_TOKEN'))
    has_file_credentials = os.path.exists('credentials.json') and os.path.exists('token.json')
    if not (has_env_credentials or has_file_credentials):
        print("Error: Gmail credentials are not configured.")
        return False

    print(f"Parser start: lookback_hours={hours} max_results={max_results}")
    print("Connecting to Gmail API...")

    try:
        gmail = GmailService()
        try:
            profile = gmail.service.users().getProfile(userId='me').execute()
            connected_email = profile.get('emailAddress')
            print(f"Connected to Gmail API as {connected_email}" if connected_email else "Connected to Gmail API")
        except Exception:
            print("Connected to Gmail API")

        emails = gmail.fetch_emails(since_hours=hours, max_results=max_results)
        print(f"Parser fetch: found={len(emails)}")
        if not emails:
            print("Parser complete: found=0 parsed=0 new=0 matched=0 unmatched=0 duplicate=0 failed=0")
            return True

        db = get_db()
        new_count = matched = unmatched = duplicate = unparsed = failed = 0
        try:
            for email_data in emails:
                gmail_id = email_data["gmail_id"]
                try:
                    created, outcome = process_email(db, email_data["raw"], gmail_id)
                    if created:
                        db.commit()
                        new_count += 1
                        matched += outcome == "matched"
                        unmatched += outcome == "unmatched"
                    else:
                        db.rollback()
                        duplicate += outcome == "duplicate"
                        unparsed += outcome == "unparsed"
                except Exception as email_error:
                    db.rollback()
                    failed += 1
                    print(f"Parser email error: gmail_id={gmail_id[:16]} error={type(email_error).__name__}")

            print(
                f"Parser complete: found={len(emails)} new={new_count} matched={matched} "
                f"unmatched={unmatched} duplicate={duplicate} unparsed={unparsed} failed={failed}"
            )
            return True
        finally:
            db.close()
    except Exception as e:
        print(f"Parser fatal error: {type(e).__name__}: {e}")
        return False


def run_with_local_files(directory: str) -> bool:
    from pathlib import Path
    eml_files = list(Path(directory).rglob('*.eml'))
    print(f"Local parser start: files={len(eml_files)}")
    if not eml_files:
        return True
    db = get_db()
    processed = failed = 0
    try:
        for eml_path in eml_files:
            try:
                with open(eml_path, 'rb') as f:
                    created, _ = process_email(db, f.read())
                    if created:
                        db.commit()
                        processed += 1
                    else:
                        db.rollback()
            except Exception as file_error:
                db.rollback()
                failed += 1
                print(f"Local parser error: file={eml_path.name} error={type(file_error).__name__}")
        print(f"Local parser complete: files={len(eml_files)} new={processed} failed={failed}")
        return True
    finally:
        db.close()


if __name__ == "__main__":
    success = False
    if len(sys.argv) > 1 and sys.argv[1].endswith('.eml'):
        success = run_with_local_files(sys.argv[1])
    else:
        hours = 1
        if '--hours' in sys.argv:
            try:
                hours = int(sys.argv[sys.argv.index('--hours') + 1])
            except (ValueError, IndexError):
                print("Invalid --hours argument, defaulting to 1 hour")

        max_results = 50
        use_from_last = '--from-last' in sys.argv
        if os.getenv("GITHUB_ACTIONS", "").lower() == "true" and '--no-from-last' not in sys.argv:
            use_from_last = True

        if use_from_last:
            db = get_db()
            try:
                last_created_at = get_last_payment_created_at(db)
            finally:
                db.close()
            if last_created_at:
                hours = compute_backfill_hours(last_created_at, min_hours=hours, safety_hours=1)
                max_results = 2000
                print(f"Parser backfill: last_created_at={last_created_at.isoformat()} lookback_hours={hours}")

        success = run_with_gmail(hours=hours, max_results=max_results)

    if not success:
        sys.exit(1)
