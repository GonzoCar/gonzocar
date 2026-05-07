from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import unittest

from app.api.routes.status import check_billing_cron_health


@dataclass
class FakeBillingRun:
    triggered_at: datetime
    finished_at: datetime | None
    success: bool
    result_status: str | None = None
    within_charge_window: bool | None = None
    active_drivers: int | None = None
    daily_debits: int | None = None
    weekly_debits: int | None = None
    late_drivers: int | None = None
    sms_sent: int | None = None
    sms_failed: int | None = None
    error_message: str | None = None


class FakeQuery:
    def __init__(self, runs: list[FakeBillingRun]):
        self._runs = runs

    def order_by(self, *_args, **_kwargs):
        return self

    def all(self):
        return self._runs


class FakeDb:
    def __init__(self, runs: list[FakeBillingRun]):
        self._runs = runs

    def query(self, _model):
        return FakeQuery(self._runs)


class BillingCronHealthTests(unittest.TestCase):
    def test_no_runs_waiting_for_first_execution(self):
        payload = check_billing_cron_health(FakeDb([]))
        self.assertEqual(payload["status"], "warning")
        self.assertEqual(payload["total_runs"], 0)
        self.assertIn("Waiting for first billing run", payload["message"])

    def test_healthy_recent_runs(self):
        now = datetime.utcnow()
        runs = [
            FakeBillingRun(
                triggered_at=now - timedelta(hours=2),
                finished_at=now - timedelta(hours=2) + timedelta(minutes=1),
                success=True,
                result_status="completed",
                within_charge_window=False,
                daily_debits=0,
                weekly_debits=0,
                sms_sent=0,
                sms_failed=0,
            ),
            FakeBillingRun(
                triggered_at=now - timedelta(hours=1),
                finished_at=now - timedelta(hours=1) + timedelta(minutes=1),
                success=True,
                result_status="completed",
                within_charge_window=True,
                daily_debits=1,
                weekly_debits=2,
                sms_sent=1,
                sms_failed=0,
            ),
            FakeBillingRun(
                triggered_at=now - timedelta(minutes=10),
                finished_at=now - timedelta(minutes=9),
                success=True,
                result_status="skipped_outside_window",
                within_charge_window=False,
                daily_debits=0,
                weekly_debits=0,
                sms_sent=0,
                sms_failed=0,
            ),
        ]

        payload = check_billing_cron_health(FakeDb(runs))
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["failed_runs_24h"], 0)
        self.assertEqual(payload["missed_windows_24h"], 0)
        self.assertEqual(payload["health_score_24h"], 100.0)
        self.assertIsNotNone(payload["last_charge_window_run_at"])


if __name__ == "__main__":
    unittest.main()
