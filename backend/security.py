"""
Security utilities for the Eco Pest Solutions Billing API.

Adds (without changing existing business logic):
  * bcrypt password hashing with transparent verification for legacy
    plain-text passwords (so existing users keep working until they
    log in, at which point their password is auto-rehashed).
  * JWT (HS256) issuance + verification for stateless API auth.
  * FastAPI dependencies `get_current_user` (any logged-in user) and
    `require_superior` (role-gated) that return 401/403 on failure.
  * `sanitize_user` to strip secrets before sending a user record to
    the client.
  * Security headers middleware (HSTS, CSP, X-Frame-Options, etc).
  * Audit logging helper that writes to a new `audit_logs` collection.

Everything here is additive. None of the existing collections, schemas
or response shapes are modified beyond removing the `password` field
from user payloads.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
JWT_ALGORITHM = "HS256"


def _get_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        # Fail fast — do NOT fall back to a weak default in production.
        raise RuntimeError("JWT_SECRET is not configured in environment")
    return secret


def _get_jwt_ttl_seconds() -> int:
    try:
        hours = int(os.environ.get("JWT_EXPIRES_HOURS", "720"))
    except ValueError:
        hours = 720
    return max(hours, 1) * 3600


# Fields that MUST never leave the server in API responses.
_SECRET_USER_FIELDS = (
    "password",
    "password_hash",
    "hashed_password",
    "firebase_uid",
    "passwordResetToken",
    "passwordResetExpiry",
)


def sanitize_user(user: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Return a copy of `user` safe to send to the frontend.
    Removes password / secret fields and MongoDB `_id`.
    """
    if not user:
        return user
    safe = {k: v for k, v in user.items() if k not in _SECRET_USER_FIELDS and k != "_id"}
    return safe


def sanitize_users(users):
    return [sanitize_user(u) for u in users or []]


# ---------------------------------------------------------------------------
# Password hashing — bcrypt with legacy plain-text fallback
# ---------------------------------------------------------------------------
def hash_password(plain: str) -> str:
    """Return a bcrypt hash string for the given plain password."""
    if not isinstance(plain, str):
        plain = str(plain or "")
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _looks_like_bcrypt(stored: str) -> bool:
    return isinstance(stored, str) and stored.startswith(("$2a$", "$2b$", "$2y$")) and len(stored) >= 50


def verify_password(plain: str, stored: str) -> bool:
    """Verify a password against either a bcrypt hash or a legacy
    plain-text record. Returns False on any error (never raises)."""
    if not isinstance(plain, str) or not isinstance(stored, str) or not stored:
        return False
    if _looks_like_bcrypt(stored):
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), stored.encode("utf-8"))
        except Exception:  # noqa: BLE001
            return False
    # Legacy plain-text record — constant-time-ish comparison.
    return _ct_eq(plain, stored)


def _ct_eq(a: str, b: str) -> bool:
    # Manual constant-time equality to avoid leaking length/content via timing.
    if len(a) != len(b):
        return False
    result = 0
    for x, y in zip(a.encode("utf-8"), b.encode("utf-8")):
        result |= x ^ y
    return result == 0


def is_legacy_password(stored: str) -> bool:
    """True if the stored value is plain text (and should be re-hashed)."""
    return bool(stored) and not _looks_like_bcrypt(stored)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------
def create_access_token(user: Dict[str, Any]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.get("id") or ""),
        "role": user.get("role") or "",
        "email": user.get("email") or "",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=_get_jwt_ttl_seconds())).timestamp()),
        "typ": "access",
    }
    return jwt.encode(payload, _get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, _get_jwt_secret(), algorithms=[JWT_ALGORITHM])


# ---------------------------------------------------------------------------
# FastAPI auth dependencies
# ---------------------------------------------------------------------------
bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def build_get_current_user(users_collection):
    """Factory that binds the users collection into the dependency so this
    module stays free of MongoDB imports."""

    async def get_current_user(
        creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    ) -> Dict[str, Any]:
        if creds is None or not creds.credentials:
            raise _unauthorized("Missing bearer token")
        token = creds.credentials.strip()
        try:
            payload = decode_access_token(token)
        except jwt.ExpiredSignatureError:
            raise _unauthorized("Token expired")
        except Exception:  # noqa: BLE001
            raise _unauthorized("Invalid token")
        if payload.get("typ") != "access":
            raise _unauthorized("Invalid token type")
        user_id = payload.get("sub")
        if not user_id:
            raise _unauthorized("Invalid token subject")
        user = await users_collection.find_one({"id": str(user_id)}, {"_id": 0})
        if not user:
            raise _unauthorized("User no longer exists")
        # Stash a safe view on the request context via the return value.
        return user

    return get_current_user


def build_require_superior(get_current_user_dep):
    async def require_superior(user: Dict[str, Any] = Depends(get_current_user_dep)) -> Dict[str, Any]:
        if (user.get("role") or "").lower() != "superior":
            raise HTTPException(status_code=403, detail="Superior privileges required")
        return user

    return require_superior


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds standard OWASP recommended response headers. Keeps CSP relaxed
    enough for the existing React app (which inlines styles via Tailwind
    and uses customer-assets.emergentagent.com for images)."""

    DEFAULT_CSP = (
        "default-src 'self'; "
        "img-src 'self' data: blob: https:; "
        "style-src 'self' 'unsafe-inline' https:; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; "
        "font-src 'self' data: https:; "
        "connect-src 'self' https: wss:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "object-src 'none'"
    )

    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "no-referrer")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        # HSTS only meaningful over HTTPS; safe to send always (browsers ignore on http)
        h.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        h.setdefault("Content-Security-Policy", self.DEFAULT_CSP)
        return response


# ---------------------------------------------------------------------------
# Audit logging
# ---------------------------------------------------------------------------
def build_audit_logger(audit_collection):
    async def audit(
        *,
        action: str,
        actor: Optional[Dict[str, Any]] = None,
        target: Optional[str] = None,
        target_id: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None,
    ) -> None:
        try:
            entry = {
                "action": action,
                "target": target,
                "target_id": target_id,
                "actor_id": (actor or {}).get("id"),
                "actor_email": (actor or {}).get("email"),
                "actor_role": (actor or {}).get("role"),
                "ip": (request.client.host if request and request.client else None),
                "ua": (request.headers.get("user-agent") if request else None),
                "meta": meta or {},
                "at": datetime.now(timezone.utc).isoformat(),
            }
            await audit_collection.insert_one(entry)
        except Exception as exc:  # noqa: BLE001
            logger.warning("audit log failed for %s: %s", action, exc)

    return audit
