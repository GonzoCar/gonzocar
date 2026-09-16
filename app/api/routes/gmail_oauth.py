"""
Gmail OAuth authorization endpoints.

These routes let an operator authorize Gmail access via the standard
OAuth "web application" flow and retrieve the resulting credentials/token
as base64-encoded strings, ready to paste into Railway environment
variables (GMAIL_CREDENTIALS / GMAIL_TOKEN).

This does NOT store anything in the database. It is a one-time setup
helper that mirrors what `GmailService` expects at runtime.
"""

import base64
import json
import os

from fastapi import APIRouter, HTTPException, Query, status
from google_auth_oauthlib.flow import Flow

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

# Known frontend/backend domains that may host the OAuth callback.
KNOWN_DOMAINS = [
    "backend-production-7bb3e.up.railway.app",
    "web-production-96e71.up.railway.app",
]

router = APIRouter(tags=["gmail-oauth"])


def _get_redirect_uri() -> str:
    """
    Determine the redirect URI to use for the OAuth flow.

    Preference order:
    1. Explicit FRONTEND_URL env var (if set).
    2. First known domain (backend), which also hosts this callback route.
    """
    frontend_url = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
    if frontend_url:
        return f"{frontend_url}/oauth/callback"

    return f"https://{KNOWN_DOMAINS[0]}/oauth/callback"


def _get_client_config() -> dict:
    """Build an OAuth client config dict from env variables."""
    client_id = (os.getenv("GMAIL_CLIENT_ID") or "").strip()
    client_secret = (os.getenv("GMAIL_CLIENT_SECRET") or "").strip()

    if not client_id or not client_secret:
        return {}

    redirect_uris = [f"https://{domain}/oauth/callback" for domain in KNOWN_DOMAINS]

    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": redirect_uris,
        }
    }


def _build_flow(redirect_uri: str) -> Flow:
    client_config = _get_client_config()
    if not client_config:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Gmail OAuth is not configured. Set GMAIL_CLIENT_ID and "
                "GMAIL_CLIENT_SECRET environment variables."
            ),
        )

    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = redirect_uri
    return flow


@router.get("/auth")
def start_gmail_auth():
    """
    Start the Gmail OAuth flow.

    Returns a Google authorization URL that the user should open in a
    browser and grant access. After granting access, Google redirects
    to /oauth/callback with a `code` and `state`.
    """
    redirect_uri = _get_redirect_uri()

    try:
        flow = _build_flow(redirect_uri)
        authorization_url, state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to build Gmail authorization URL: {str(exc)[:240]}",
        )

    return {
        "authorization_url": authorization_url,
        "state": state,
        "redirect_uri": redirect_uri,
    }


def _exchange_code_for_credentials(code: str, redirect_uri: str):
    """Try exchanging the code using the given redirect_uri."""
    flow = _build_flow(redirect_uri)
    flow.fetch_token(code=code)
    return flow.credentials


@router.api_route("/oauth/callback", methods=["GET", "POST"])
def gmail_oauth_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
):
    """
    Handle the OAuth redirect from Google.

    Exchanges the authorization `code` for credentials, then returns the
    resulting Gmail credentials/token as base64-encoded JSON, ready to be
    set as GMAIL_CREDENTIALS / GMAIL_TOKEN environment variables.

    No secrets are stored or logged; only the caller of this endpoint
    receives the base64-encoded payload in the HTTP response.
    """
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google returned an error: {error}",
        )

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing 'code' query parameter",
        )

    client_config = _get_client_config()
    if not client_config:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Gmail OAuth is not configured. Set GMAIL_CLIENT_ID and "
                "GMAIL_CLIENT_SECRET environment variables."
            ),
        )

    last_error: Exception | None = None
    credentials = None

    # The redirect_uri used to exchange the code must match the one used
    # to generate the authorization URL. Since we don't persist state,
    # try each known domain's callback URL until one works.
    candidate_redirect_uris = [f"https://{domain}/oauth/callback" for domain in KNOWN_DOMAINS]

    frontend_url = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
    if frontend_url:
        candidate_redirect_uris.insert(0, f"{frontend_url}/oauth/callback")

    for redirect_uri in candidate_redirect_uris:
        try:
            credentials = _exchange_code_for_credentials(code, redirect_uri)
            break
        except Exception as exc:
            last_error = exc
            continue

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Failed to exchange authorization code for a token. "
                f"({str(last_error)[:200]})"
                if last_error
                else "Failed to exchange authorization code for a token."
            ),
        )

    try:
        token_json = credentials.to_json()

        gmail_credentials_payload = {
            "web": {
                "client_id": credentials.client_id,
                "client_secret": credentials.client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": credentials.token_uri or "https://oauth2.googleapis.com/token",
                "redirect_uris": [f"https://{domain}/oauth/callback" for domain in KNOWN_DOMAINS],
            }
        }

        gmail_credentials_b64 = base64.b64encode(
            json.dumps(gmail_credentials_payload).encode("utf-8")
        ).decode("utf-8")
        gmail_token_b64 = base64.b64encode(token_json.encode("utf-8")).decode("utf-8")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to encode credentials: {str(exc)[:240]}",
        )

    return {
        "message": (
            "Authorization successful. Copy these values into the "
            "GMAIL_CREDENTIALS and GMAIL_TOKEN environment variables in Railway."
        ),
        "GMAIL_CREDENTIALS": gmail_credentials_b64,
        "GMAIL_TOKEN": gmail_token_b64,
    }
