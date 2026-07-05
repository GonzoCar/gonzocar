import unittest
from decimal import Decimal
from types import SimpleNamespace

from scripts import midnight_billing as billing
from scripts.midnight_billing import _calculate_daily_days_late


class MidnightBillingLateLogicTests(unittest.TestCase):
    def test_daily_days_late_from_unpaid_balance(self):
        self.assertEqual(_calculate_daily_days_late(Decimal("-357"), Decimal("67")), 5)
        self.assertEqual(_calculate_daily_days_late(Decimal("-134"), Decimal("67")), 2)
        self.assertEqual(_calculate_daily_days_late(Decimal("-133"), Decimal("67")), 1)

    def test_daily_days_late_guard_clauses(self):
        self.assertEqual(_calculate_daily_days_late(Decimal("0"), Decimal("67")), 0)
        self.assertEqual(_calculate_daily_days_late(Decimal("15"), Decimal("67")), 0)
        self.assertEqual(_calculate_daily_days_late(Decimal("-50"), Decimal("0")), 0)
        self.assertEqual(_calculate_daily_days_late(Decimal("-50"), None), 0)

    def test_sms_reminder_is_skipped_when_balance_is_paid(self):
        driver = SimpleNamespace(id="driver-1", first_name="Jane", last_name="Doe", phone="+15551234567")
        self.assertFalse(billing.should_send_late_payment_sms(None, driver, Decimal("0"), 2))

    def test_sms_reminder_is_skipped_when_sms_is_disabled(self):
        original = billing.BILLING_SMS_DISABLED
        billing.BILLING_SMS_DISABLED = True
        try:
            driver = SimpleNamespace(id="driver-2", first_name="John", last_name="Smith", phone="+15551234568")
            self.assertFalse(billing.should_send_late_payment_sms(None, driver, Decimal("-50"), 2))
        finally:
            billing.BILLING_SMS_DISABLED = original


if __name__ == "__main__":
    unittest.main()
