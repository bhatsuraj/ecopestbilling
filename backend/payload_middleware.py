"""Response-body encryption middleware.

Buffers JSON response bodies on protected `/api/...` paths and replaces
them with `{"__enc": 1, "iv": ..., "ct": ...}` so DevTools Network
previews never show the underlying fields (emails, bank accounts,
company info, bill amounts, etc.).

Frontend Axios response interceptor must decrypt before delivering data
to the React app.
"""

from __future__ import annotations

import json
import re
from typing import Iterable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from crypto_payload import encrypt_payload


# Paths that MUST stay in plaintext (frontend reads tokens / health before key is loaded).
_PLAINTEXT_PREFIXES: tuple[str, ...] = (
    "/api/auth/",       # login, register, magic-link — frontend reads access_token directly
    "/api/seed",
    "/api/health",
    "/api/ws",          # websocket upgrade
)

# Anything else under /api/ gets encrypted.
_ENCRYPT_API = re.compile(r"^/api(/|$)")


def _should_encrypt(path: str) -> bool:
    if not _ENCRYPT_API.match(path):
        return False
    if path == "/api/" or path == "/api":
        return False
    for prefix in _PLAINTEXT_PREFIXES:
        if path.startswith(prefix):
            return False
    return True


async def _collect_body(body_iterator: Iterable[bytes]) -> bytes:
    chunks: list[bytes] = []
    async for chunk in body_iterator:  # type: ignore[union-attr]
        chunks.append(chunk)
    return b"".join(chunks)


class PayloadEncryptionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response: Response = await call_next(request)

        if not _should_encrypt(request.url.path):
            return response

        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            return response

        # Don't re-encrypt errors that already carry no sensitive data.
        # (We still encrypt to keep DevTools uniformly opaque.)
        body = await _collect_body(response.body_iterator)
        if not body:
            return response

        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            # Non-JSON despite header — pass through.
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=content_type,
            )

        encrypted = encrypt_payload(payload)
        new_body = json.dumps(encrypted, separators=(",", ":")).encode("utf-8")

        headers = dict(response.headers)
        headers.pop("content-length", None)
        headers["x-payload-encrypted"] = "1"

        return Response(
            content=new_body,
            status_code=response.status_code,
            headers=headers,
            media_type="application/json",
        )
