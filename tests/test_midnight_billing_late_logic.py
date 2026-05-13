import unittest
from decimal import Decimal

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


if __name__ == "__main__":
    unittest.main()
