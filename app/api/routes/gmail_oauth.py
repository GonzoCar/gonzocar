"""
Gmail OAuth authorization endpoints.

These routes let an operator authorize Gmail access via the standard
OAuth "web application" flow and retrieve the resulting credentials/token
as base64-encoded strings, ready to paste into Railway environment
variables (GMAIL_CREDENTIALS / GMAIL_TOKEN).
"""

import base64
import json
import os

from fastapi import APIRouter, HTTPException, Query, status
from google_auth_oauthlib.flow import Flow

# Google may return the OpenID/email scopes alongside Gmail when account
# selection is used. Include them explicitly so google-auth does not reject
# the callback with "Scope has changed".
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/gmail.readonly",
]

# This is the redirect URI registered in the Google OAuth client.
DEFAULT_REDIRECT_URI = "https://backend-production-7bb3e.up.railway.app/oauth/callback"

router = APIRouter(tags=["gmail-oauth"])


def _get_redirect_uri() -> str:
    # Keep authorization and token exchange on the exact same redirect URI.
    return (os.getenv("GMAIL_REDIRECT_URI") or DEFAULT_REDIRECT_URI).strip().rstrip("/")


def _get_client_config() -> dict:
    client_id = (os.getenv("GMAIL_CLIENT_ID") or "").strip()
    client_secret = (os.getenv("GMAIL_CLIENT_SECRET") or "").strip()
    if not client_id or not client_secret:
        return {}
    redirect_uri = _get_redirect_uri()
    return {"web": {"client_id": client_id, "client_secret": client_secret,
                     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                     "token_uri": "https://oauth2.googleapis.com/token",
                     "redirect_uris": [redirect_uri]}}


def _build_flow(redirect_uri: str) -> Flow:
    client_config = _get_client_config()
    if not client_config:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Gmail OAuth is not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables.")
    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = redirect_uri
    return flow


@router.get("/auth")
def start_gmail_auth():
    redirect_uri = _get_redirect_uri()
    try:
        flow = _build_flow(redirect_uri)
        authorization_url, state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            # Match the reference relay behavior: force account selection
            # and show consent so Google can issue a fresh offline token.
            prompt="select_account consent",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Failed to build Gmail authorization URL: {str(exc)[:240]}")
    return {"authorization_url": authorization_url, "state": state, "redirect_uri": redirect_uri}


def _exchange_code_for_credentials(code: str, redirect_uri: str):
    flow = _build_flow(redirect_uri)
    flow.fetch_token(code=code)
    return flow.credentials


@router.api_route("/oauth/callback", methods=["GET", "POST"])
def gmail_oauth_callback(code: str | None = Query(default=None),
                         state: str | None = Query(default=None),
                         error: str | None = Query(default=None)):
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Google returned an error: {error}")
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Missing 'code' query parameter")

    redirect_uri = _get_redirect_uri()
    try:
        credentials = _exchange_code_for_credentials(code, redirect_uri)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Failed to exchange authorization code for a token. " + f"({str(exc)[:240]})")

    try:
        token_json = credentials.to_json()
        gmail_credentials_payload = {"web": {
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": credentials.token_uri or "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri],
        }}
        gmail_credentials_b64 = base64.b64encode(json.dumps(gmail_credentials_payload).encode()).decode()
        gmail_token_b64 = base64.b64encode(token_json.encode()).decode()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to encode credentials: {str(exc)[:240]}")

    return {"message": "Authorization successful. Copy these values into the GMAIL_CREDENTIALS and GMAIL_TOKEN environment variables in Railway.",
            "GMAIL_CREDENTIALS": gmail_credentials_b64,
            "GMAIL_TOKEN": gmail_token_b64}
