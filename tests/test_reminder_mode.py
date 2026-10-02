from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from scripts import midnight_billing


class _ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar(self):
        return self.value


class _FakeDb:
    def __init__(self, value):
        self.value = value

    def execute(self, _query):
        return _ScalarResult(self.value)


class ReminderModeTests(unittest.TestCase):
    def test_missing_setting_fails_closed_to_manual(self):
        self.assertFalse(
            midnight_billing.reminder_mode_is_automatic(_FakeDb(None))
        )

    def test_manual_setting_disables_automatic_reminders(self):
        self.assertFalse(
            midnight_billing.reminder_mode_is_automatic(_FakeDb("manual"))
        )

    def test_automatic_setting_enables_automatic_reminders(self):
        self.assertTrue(
            midnight_billing.reminder_mode_is_automatic(_FakeDb("automatic"))
        )

    def test_railway_env_cannot_override_manual_setting(self):
        with patch.dict(
            os.environ,
            {"AUTOMATIC_OVERDUE_REMINDERS": "true"},
            clear=False,
        ):
            self.assertFalse(
                midnight_billing.reminder_mode_is_automatic(_FakeDb("manual"))
            )

    def test_invalid_setting_fails_closed(self):
        self.assertFalse(
            midnight_billing.reminder_mode_is_automatic(_FakeDb("enabled"))
        )


if __name__ == "__main__":
    unittest.main()
