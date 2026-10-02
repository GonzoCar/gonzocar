from email.message import EmailMessage

from app.services.gmail_parser import parse_email_diagnostic


def make_email(subject: str, sender: str, body: str) -> bytes:
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = "payments@example.com"
    msg["Subject"] = subject
    msg["Date"] = "Thu, 02 Oct 2026 10:00:00 +0000"
    msg.set_content(body)
    return msg.as_bytes()


def test_generic_parser_handles_payment_of_from_wording():
    raw = make_email(
        "Payment received",
        "notifications@cash.app",
        "Payment of $125.50 from Jane Doe for vehicle payment.",
    )
    payment, diagnostics = parse_email_diagnostic(raw)
    assert payment is not None
    assert payment.amount == 125.50
    assert payment.sender_name == "Jane Doe"
    assert payment.source == "cashapp"
    assert diagnostics["payment_candidate"] is True


def test_diagnostic_reports_payment_like_unparsed_email():
    raw = make_email(
        "Payment received",
        "notifications@venmo.com",
        "A payment was received. Amount $77.25. Reference unavailable.",
    )
    payment, diagnostics = parse_email_diagnostic(raw)
    assert payment is None
    assert diagnostics["payment_candidate"] is True
    assert diagnostics["failure_reason"] == "payment_like_email_did_not_match_a_supported_template"


def test_preferred_source_is_used_for_reprocessing():
    raw = make_email(
        "Money transfer",
        "forwarder@example.com",
        "Payment of $210 from Alex Driver for weekly rent.",
    )
    payment, diagnostics = parse_email_diagnostic(raw, preferred_source="cashapp")
    assert payment is not None
    assert payment.source == "cashapp"
    assert diagnostics["detected_source"] == "cashapp"
