import unittest

from app.services.gmail_parser import ZelleParser


class GmailParserAddressTests(unittest.TestCase):
    def test_zelle_can_parse_direct_chase_sender(self):
        self.assertTrue(
            ZelleParser.can_parse(
                "Chase <no.reply.alerts@chase.com>",
                "You received money with Zelle®",
            )
        )

    def test_zelle_can_parse_forwarded_gonzocar_sender(self):
        self.assertTrue(
            ZelleParser.can_parse(
                "Ashwood Holdings <payashwood@gonzocar.com>",
                "Fwd: You received money with Zelle®",
            )
        )

    def test_zelle_ignores_non_zelle_subject(self):
        self.assertFalse(
            ZelleParser.can_parse(
                "Ashwood Holdings <payashwood@gonzocar.com>",
                "Monthly report",
            )
        )


if __name__ == "__main__":
    unittest.main()
