#!/usr/bin/env python3
"""
Cron Job: Billing

Runs automatically to:
1. Create debit entries for active drivers based on their billing rate
2. Detect late payments (daily: >= 2 days, weekly: >= 48 hours)
3. Send SMS reminders for late payments
4. Log all SMS activity

Usage:
    python scripts/midnight_billing.py

Crontab (hourly + guarded in code):
    0 * * * * cd /path/to/gonzocar && python scripts/midnight_billing.py
"""

import sys
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from decimal import Decimal

from sqlalchemy import text

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load env before imports
from dotenv import load_dotenv
load_dotenv('.env.local')

from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.core.database import SessionLocal
from app.models import (
    Driver, Ledger, SmsLog, Alias, PaymentRaw,
    LedgerType, BillingType, BillingStatus,
)
from app.services.openphone import openphone, SmsTemplates
from app.services.billing import (
    CHICAGO_TZ,
    default_weekly_due_day,
    is_charge_window,
    normalize_weekly_due_day,
)

# Safety controls
# BILLING_SMS_DISABLED=true  -> debits/balances still run, but no SMS is sent.
# MAX_CONSECUTIVE_REMINDERS  -> stop repeat-texting a driver after this many
#                               reminder days with no payment credited in between.
# AUTOMATIC_OVERDUE_REMINDERS=false -> disable all automated overdue SMS reminders.
BILLING_SMS_DISABLED = os.getenv("BILLING_SMS_DISABLED", "false").strip().lower() in {"1", "true", "yes"}
MAX_CONSECUTIVE_REMINDERS = int(os.getenv("MAX_CONSECUTIVE_REMINDERS", "3"))
AUTOMATIC_OVERDUE_REMINDERS = os.getenv("AUTOMATIC_OVERDUE_REMINDERS", "false").strip().lower() in {"1", "true", "yes"}


def reminder_mode_is_automatic() -> bool:
    """Return True when automatic overdue reminders are enabled."""
    if BILLING_SMS_DISABLED:
        return False

    if os.getenv("AUTOMATIC_OVERDUE_REMINDERS") is not None:
        return os.getenv("AUTOMATIC_OVERDUE_REMINDERS", "false").strip().lower() in {"1", "true", "yes"}

    try:
        with get_db() as db:
            value = db.execute(text("SELECT value FROM settings WHERE key = 'reminder_mode' LIMIT 1")).scalar()
            if value is None:
                return False
            return str(value).strip().lower() == "automatic"
    except Exception:
        return AUTOMATIC_OVERDUE_REMINDERS


def get_db() -> Session:
    """Get database session."""
    return SessionLocal()


def calculate_balance(db: Session, driver_id) -> Decimal:
    """Calculate driver's current balance (credits - debits)."""
    credits = db.query(func.sum(Ledger.amount)).filter(
        Ledger.driver_id == driver_id,
        Ledger.type == LedgerType.credit
    ).scalar() or Decimal('0')
    
    debits = db.query(func.sum(Ledger.amount)).filter(
        Ledger.driver_id == driver_id,
        Ledger.type == LedgerType.debit
    ).scalar() or Decimal('0')
    
    return credits - debits


def get_last_debit_date(db: Session, driver_id) -> datetime:
    """Get the date of the last debit entry for a driver."""
    last_debit = db.query(Ledger).filter(
        Ledger.driver_id == driver_id,
        Ledger.type == LedgerType.debit
    ).order_by(Ledger.created_at.desc()).first()
    
    return last_debit.created_at if last_debit else None


def _date_in_chicago(value: datetime) -> datetime.date:
    dt = value
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(CHICAGO_TZ).date()


def create_daily_debits(db: Session, drivers: list[Driver], now_local: datetime) -> int:
    """Create daily debit entries for drivers with daily billing at 5 PM Chicago."""
    count = 0
    billing_date_local = now_local.date()
    
    for driver in drivers:
        if driver.billing_type != BillingType.daily:
            continue
        
        # Check if already charged today
        last_debit_date = get_last_debit_date(db, driver.id)
        if last_debit_date and _date_in_chicago(last_debit_date) == billing_date_local:
            continue
        
        # Create debit entry
        debit = Ledger(
            id=uuid4(),
            driver_id=driver.id,
            type=LedgerType.debit,
            amount=driver.billing_rate,
            description=f"Daily rental charge",
            created_at=datetime.utcnow()
        )
        db.add(debit)
        count += 1
        print(f"  Created daily debit: {driver.first_name} {driver.last_name} - ${driver.billing_rate}")
    
    return count


def create_weekly_debits(db: Session, drivers: list[Driver], now_local: datetime) -> int:
    """Create weekly debit entries for drivers with weekly billing at 5 PM Chicago."""
    count = 0
    billing_date_local = now_local.date()
    billing_weekday = now_local.strftime("%A").lower()
    
    for driver in drivers:
        if driver.billing_type != BillingType.weekly:
            continue

        due_day = normalize_weekly_due_day(getattr(driver, "weekly_due_day", None)) or default_weekly_due_day()
        if due_day != billing_weekday:
            continue
        
        # Check if already charged this week
        last_debit_date = get_last_debit_date(db, driver.id)
        if last_debit_date and _date_in_chicago(last_debit_date) == billing_date_local:
            continue
        
        # Create debit entry
        debit = Ledger(
            id=uuid4(),
            driver_id=driver.id,
            type=LedgerType.debit,
            amount=driver.billing_rate,
            description=f"Weekly rental charge ({due_day.title()})",
            created_at=datetime.utcnow()
        )
        db.add(debit)
        count += 1
        print(f"  Created weekly debit: {driver.first_name} {driver.last_name} - ${driver.billing_rate}")
    
    return count


def check_late_payments(db: Session, drivers: list[Driver]) -> list[tuple]:
    """
    Check for late payments based on billing type.
    
    Late criteria:
    - Daily billing: negative balance for >= 2 days
    - Weekly billing: negative balance for >= 48 hours
    
    Returns list of (driver, balance, days_late)
    """
    late_drivers = []
    now = datetime.utcnow()
    
    for driver in drivers:
        balance = calculate_balance(db, driver.id)

        if balance >= 0:
            continue

        # Daily logic must not rely on "last debit date", because daily drivers
        # are charged every day and would otherwise never reach 2+ days late.
        if driver.billing_type == BillingType.daily:
            days_late = _calculate_daily_days_late(balance, driver.billing_rate)
            if days_late >= 2:
                late_drivers.append((driver, balance, days_late))
            continue

        # Weekly and fallback logic: use last debit age (48+ hours late).
        last_debit = db.query(Ledger).filter(
            Ledger.driver_id == driver.id,
            Ledger.type == LedgerType.debit
        ).order_by(Ledger.created_at.desc()).first()

        if not last_debit:
            continue

        days_late = (now - last_debit.created_at).days
        if days_late >= 2:
            late_drivers.append((driver, balance, days_late))
    
    return late_drivers


def _calculate_daily_days_late(balance: Decimal, billing_rate: Decimal) -> int:
    """
    Estimate overdue days for daily billing from unpaid balance.

    Example:
    - balance -357, rate 67 => 5 days late
    - balance -133, rate 67 => 1 day late
    """
    if balance >= 0:
        return 0
    if billing_rate is None:
        return 0

    rate = Decimal(billing_rate)
    if rate <= 0:
        return 0

    unpaid = abs(Decimal(balance))
    return int(unpaid // rate)


def _find_driver_by_alias(db: Session, sender_name: str, sender_identifier: str) -> Driver:
    """Match a payment sender to a driver via the aliases table (same logic as the payment parser)."""
    candidates = []
    if sender_name and sender_name.strip():
        candidates.append(sender_name.strip())
    if sender_identifier and sender_identifier.strip():
        candidates.append(sender_identifier.strip())

    for candidate in candidates:
        alias = db.query(Alias).filter(
            func.lower(Alias.alias_value) == candidate.lower()
        ).first()
        if alias:
            return db.query(Driver).filter(Driver.id == alias.driver_id).first()

    return None


def rematch_unmatched_payments(db: Session) -> int:
    """
    Re-check unmatched payments against the alias table before lateness is
    evaluated. Catches payments that arrived but missed matching (alias added
    after the payment landed, parser timing, etc.) and credits them so drivers
    who already paid are not flagged late or texted again.
    """
    count = 0
    unmatched = db.query(PaymentRaw).filter(
        or_(PaymentRaw.matched.is_(False), PaymentRaw.matched.is_(None))
    ).order_by(PaymentRaw.created_at.asc()).all()

    for payment in unmatched:
        driver = _find_driver_by_alias(db, payment.sender_name, payment.sender_identifier)
        if not driver:
            continue

        # Never double-credit: skip ledger insert if a credit already references this payment.
        existing_credit = db.query(Ledger).filter(
            Ledger.reference_id == payment.id,
            Ledger.type == LedgerType.credit,
        ).first()
        if not existing_credit:
            source_label = payment.source.value.upper() if payment.source else "PAYMENT"
            credit = Ledger(
                id=uuid4(),
                driver_id=driver.id,
                type=LedgerType.credit,
                amount=payment.amount,
                description=f"{source_label} payment from {payment.sender_name} (auto re-match)",
                reference_id=payment.id,
                created_at=datetime.utcnow(),
            )
            db.add(credit)

        payment.matched = True
        payment.driver_id = driver.id
        count += 1
        print(f"  Re-matched payment ${payment.amount} from {payment.sender_name} -> {driver.first_name} {driver.last_name}")

    return count


def has_hit_reminder_cap(db: Session, driver: Driver) -> bool:
    """
    True when the driver has already been reminded on MAX_CONSECUTIVE_REMINDERS
    distinct days with no credit posted since. Repeat texts past that point are
    noise; the payment likely never reached payments_raw and needs manual
    review (scripts/reconcile_payments.py).
    """
    last_credit = db.query(Ledger).filter(
        Ledger.driver_id == driver.id,
        Ledger.type == LedgerType.credit,
    ).order_by(Ledger.created_at.desc()).first()

    query = db.query(func.count(func.distinct(func.date(SmsLog.created_at)))).filter(
        SmsLog.driver_id == driver.id,
        SmsLog.status == 'sent',
    )
    if last_credit:
        query = query.filter(SmsLog.created_at > last_credit.created_at)

    reminder_days = query.scalar() or 0
    return reminder_days >= MAX_CONSECUTIVE_REMINDERS


def should_send_late_payment_sms(db: Session, driver: Driver, balance: Decimal, days_late: int) -> bool:
    """Return False when no reminder SMS should be sent for this driver."""
    if BILLING_SMS_DISABLED or not reminder_mode_is_automatic():
        return False

    if balance >= 0:
        return False

    if db is not None and has_hit_reminder_cap(db, driver):
        return False

    return True


def send_late_payment_sms(db: Session, driver: Driver, balance: Decimal, days_late: int) -> str:
    """Send late payment SMS and log it."""
    if not should_send_late_payment_sms(db, driver, balance, days_late):
        print(f"  Skipping SMS reminder for {driver.first_name} {driver.last_name} due to payment status or safety controls")
        return "skipped"

    # Check if we already sent SMS today
    today = datetime.utcnow().date()
    existing_sms = db.query(SmsLog).filter(
        SmsLog.driver_id == driver.id,
        func.date(SmsLog.created_at) == today
    ).first()
    
    if existing_sms:
        print(f"  Already sent SMS today to {driver.first_name} {driver.last_name}")
        return "skipped"
    
    # Prepare message
    message = SmsTemplates.late_payment(
        driver_name=driver.first_name,
        amount=abs(float(balance)),
        days_late=days_late
    )
    
    # Send SMS
    result = openphone.send_sms_sync(driver.phone, message)
    
    # Log SMS
    sms_log = SmsLog(
        id=uuid4(),
        driver_id=driver.id,
        phone=driver.phone,
        message=message,
        status='sent' if result.success else 'failed',
        openphone_response={'message_id': result.message_id, 'error': result.error},
        created_at=datetime.utcnow()
    )
    db.add(sms_log)
    
    if result.success:
        print(f"  Sent late payment SMS to {driver.first_name} {driver.last_name}")
    else:
        print(f"  Failed to send SMS to {driver.first_name} {driver.last_name}: {result.error}")
    
    return "sent" if result.success else "failed"


def run_billing() -> dict:
    """Main billing job."""
    print(f"[{datetime.now()}] Starting billing job")
    summary: dict[str, object] = {
        "status": "started",
        "within_charge_window": False,
        "chicago_now": None,
        "active_drivers": 0,
        "daily_debits": 0,
        "weekly_debits": 0,
        "late_drivers": 0,
        "sms_sent": 0,
        "sms_failed": 0,
        "sms_skipped": 0,
    }
    now_local = datetime.now(CHICAGO_TZ)
    summary["chicago_now"] = now_local.isoformat()
    print(f"Chicago local time: {now_local.isoformat()}")
    within_charge_window = is_charge_window(now_local, target_hour=17)
    summary["within_charge_window"] = within_charge_window
    if not within_charge_window:
        print("Outside 5 PM Chicago charge window. Skipping billing run.")
        summary["status"] = "skipped_outside_window"
        return summary
    
    db = get_db()
    
    try:
        # Get active drivers
        drivers = db.query(Driver).filter(
            or_(
                Driver.billing_status == BillingStatus.active,
                (Driver.billing_status.is_(None) & (Driver.billing_active == True)),
            )
        ).all()
        summary["active_drivers"] = len(drivers)
        print(f"Found {len(drivers)} active drivers")
        
        if not drivers:
            print("No active drivers, exiting")
            summary["status"] = "no_active_drivers"
            return summary
        
        # Create debit entries
        print("\n--- Creating Debit Entries ---")
        daily_count = create_daily_debits(db, drivers, now_local)
        weekly_count = create_weekly_debits(db, drivers, now_local)
        summary["daily_debits"] = daily_count
        summary["weekly_debits"] = weekly_count
        print(f"Created {daily_count} daily debits, {weekly_count} weekly debits")
        
        # Re-match any unmatched payments before deciding who is late.
        rematched = rematch_unmatched_payments(db)
        if rematched:
            print(f"Re-matched {rematched} unmatched payments")

        # Check for late payments
        print("\n--- Checking Late Payments ---")
        late_drivers = check_late_payments(db, drivers)
        summary["late_drivers"] = len(late_drivers)
        print(f"Found {len(late_drivers)} late drivers")
        
        # Send SMS reminders
        if late_drivers:
            print("\n--- Sending SMS Reminders ---")
            for driver, balance, days_late in late_drivers:
                print(f"  {driver.first_name} {driver.last_name}: ${balance:.2f} ({days_late} days late)")
                sms_result = send_late_payment_sms(db, driver, balance, days_late)
                if sms_result == "sent":
                    summary["sms_sent"] = int(summary["sms_sent"]) + 1
                elif sms_result == "failed":
                    summary["sms_failed"] = int(summary["sms_failed"]) + 1
                else:
                    summary["sms_skipped"] = int(summary["sms_skipped"]) + 1
        
        # Commit all changes
        db.commit()
        summary["status"] = "completed"
        print(f"\n[{datetime.now()}] Billing job completed successfully")
        return summary
        
    except Exception as e:
        db.rollback()
        summary["status"] = "failed"
        summary["error"] = str(e)
        print(f"Error during billing: {e}")
        raise
    finally:
        db.close()


def run_with_dry_run():
    """Dry run mode - show what would happen without making changes."""
    print(f"[{datetime.now()}] DRY RUN - Billing preview")
    
    db = get_db()
    
    try:
        drivers = db.query(Driver).filter(
            or_(
                Driver.billing_status == BillingStatus.active,
                (Driver.billing_status.is_(None) & (Driver.billing_active == True)),
            )
        ).all()
        print(f"Found {len(drivers)} active drivers")
        
        print("\n--- Would Create Debits For ---")
        for driver in drivers:
            balance = calculate_balance(db, driver.id)
            print(f"  {driver.first_name} {driver.last_name}")
            print(f"    Type: {driver.billing_type.value}, Rate: ${driver.billing_rate}")
            print(f"    Current Balance: ${balance:.2f}")
        
        print("\n--- Late Payments ---")
        late_drivers = check_late_payments(db, drivers)
        for driver, balance, days_late in late_drivers:
            print(f"  {driver.first_name} {driver.last_name}")
            print(f"    Balance: ${balance:.2f}, Days Late: {days_late}")
            print(f"    Would send SMS to: {driver.phone}")
        
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--dry-run":
        run_with_dry_run()
    else:
        run_billing()
