"""Firebase Admin SDK initialization + ID-token verification helpers.

Service account credentials are loaded from the FIREBASE_SERVICE_ACCOUNT_JSON
env variable (the full JSON content as a single string). This keeps the secret
in /app/backend/.env (which is git-ignored) — never in a tracked file.

For local-only development you can ALSO drop the JSON at
/app/backend/secrets/firebase-admin.json and it will be picked up as a
fallback. That path is git-ignored too.
"""
import json
import os
from pathlib import Path
from typing import Optional

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

_FALLBACK_PATH = Path(__file__).parent / "secrets" / "firebase-admin.json"


def _load_credentials() -> credentials.Certificate:
    """Prefer env-variable (cloud-friendly), fall back to local file path."""
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if raw:
        return credentials.Certificate(json.loads(raw))
    if _FALLBACK_PATH.exists():
        return credentials.Certificate(str(_FALLBACK_PATH))
    raise RuntimeError(
        "Firebase service account not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON "
        "in backend/.env (recommended) or place the JSON at "
        f"{_FALLBACK_PATH}."
    )


def init_firebase() -> firebase_admin.App:
    """Idempotent Firebase Admin initialization. Safe to call multiple times."""
    if firebase_admin._apps:
        return firebase_admin.get_app()
    return firebase_admin.initialize_app(_load_credentials())


def verify_id_token(token: str) -> dict:
    """Verify a Firebase ID token. Raises on invalid/expired token.

    Returns the decoded token (contains uid, email, phone_number, etc.).
    """
    return firebase_auth.verify_id_token(token, check_revoked=False)


def get_firebase_user(uid: str) -> Optional[dict]:
    try:
        user = firebase_auth.get_user(uid)
        return {
            "uid": user.uid,
            "email": user.email,
            "phone_number": user.phone_number,
            "display_name": user.display_name,
        }
    except firebase_auth.UserNotFoundError:
        return None
