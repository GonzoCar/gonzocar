from datetime import datetime
import unittest

from app.api.routes.status import _compute_parser_miss_events


class ParserMissHistoryTests(unittest.TestCase):
    def test_no_runs_has_no_misses(self):
        events, total = _compute_parser_miss_events(
            run_times=[],
            now=datetime(2026, 4, 17, 10, 0, 0),
            interval_minutes=5,
            grace_minutes=2,
        )
        self.assertEqual(events, [])
        self.assertEqual(total, 0)

    def test_detects_recovered_gap(self):
        run_times = [
            datetime(2026, 4, 17, 10, 0, 0),
            datetime(2026, 4, 17, 10, 20, 0),
        ]
        events, total = _compute_parser_miss_events(
            run_times=run_times,
            now=datetime(2026, 4, 17, 10, 25, 0),
            interval_minutes=5,
            grace_minutes=2,
        )
        self.assertEqual(total, 3)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["missed_intervals"], 3)
        self.assertEqual(events[0]["recovered_at"], "2026-04-17T10:20:00")

    def test_detects_ongoing_delay(self):
        run_times = [datetime(2026, 4, 17, 10, 0, 0)]
        events, total = _compute_parser_miss_events(
            run_times=run_times,
            now=datetime(2026, 4, 17, 10, 18, 0),
            interval_minutes=5,
            grace_minutes=2,
        )
        self.assertEqual(total, 3)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["recovered_at"], None)
        self.assertEqual(events[0]["missed_intervals"], 3)


if __name__ == "__main__":
    unittest.main()
