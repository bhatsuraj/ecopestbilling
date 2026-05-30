"""AES-GCM payload obfuscation.

Wraps API response bodies in `{"__enc": 1, "iv": <b64url>, "ct": <b64url>}`
so DevTools Network previews show only ciphertext, not the underlying
fields (emails, bank accounts, company info, etc.).

This is *obfuscation*, not protection against the logged-in user — the
shared symmetric key is shipped to the browser via REACT_APP_PAYLOAD_KEY.
Its purpose is to defeat casual DevTools snooping, screen captures, and
support-channel screenshot leaks. Real authorization is still enforced
by JWT + RBAC.
"""

from __future__ import annotations

import base64
import json
import os
import secrets
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


_RAW_KEY = os.environ.get("PAYLOAD_ENCRYPTION_KEY", "")
if not _RAW_KEY:
    raise RuntimeError("PAYLOAD_ENCRYPTION_KEY missing from backend .env")

_KEY_BYTES = _b64url_decode(_RAW_KEY)
if len(_KEY_BYTES) not in (16, 24, 32):
    raise RuntimeError(
        f"PAYLOAD_ENCRYPTION_KEY must decode to 16/24/32 bytes, got {len(_KEY_BYTES)}"
    )

_AESGCM = AESGCM(_KEY_BYTES)


def encrypt_payload(obj: Any) -> dict[str, Any]:
    """AES-GCM-encrypt a JSON-serialisable object."""
    plaintext = json.dumps(obj, separators=(",", ":"), default=str).encode("utf-8")
    iv = secrets.token_bytes(12)
    ct = _AESGCM.encrypt(iv, plaintext, None)
    return {"__enc": 1, "iv": _b64url_encode(iv), "ct": _b64url_encode(ct)}
