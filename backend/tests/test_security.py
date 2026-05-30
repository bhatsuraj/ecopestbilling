"""Security hardening verification tests for Eco Pest Solutions billing API.

Covers:
  * P0 - GET /api/users must NOT leak password fields.
  * POST /api/auth/simple-login (admin + assistant) returns token without password.
  * Legacy plaintext password is auto-migrated to bcrypt on login.
  * Security response headers present.
  * Wrong password rejected with generic 401 (no disclosure).
"""

from __future__ import annotations

import os
import re

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from frontend/.env so pytest still runs.
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except FileNotFoundError:
        pass

API = f"{BASE_URL}/api"

ADMIN_EMAIL = "surajbhat2001@gmail.com"
ADMIN_PHONE = "+918746919550"
ADMIN_PASSWORD = "Suraj@262001"

ASSISTANT_PHONE = "+918105004458"
ASSISTANT_EMAIL = "rohit@gmail.com"
ASSISTANT_PASSWORD = "Rohit@2026"

SECRET_KEYS = {"password", "password_hash", "hashed_password", "firebase_uid",
               "passwordResetToken", "passwordResetExpiry"}


def _contains_secret(obj) -> str | None:
    """Recursively check if any secret key is in the JSON body. Returns the
    offending key name if found, else None."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in SECRET_KEYS:
                return k
            found = _contains_secret(v)
            if found:
                return found
    elif isinstance(obj, list):
        for it in obj:
            found = _contains_secret(it)
            if found:
                return found
    return None


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_login(session):
    r = session.post(f"{API}/auth/simple-login",
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:300]}"
    return r.json()


# --------------------------------------------------------------------------- #
# /api/users - P0: no password in response
# --------------------------------------------------------------------------- #
class TestUsersEndpoint:
    def test_get_users_returns_200(self, session):
        r = session.get(f"{API}/users")
        assert r.status_code == 200, r.text[:300]

    def test_get_users_no_password_field_anywhere(self, session):
        r = session.get(f"{API}/users")
        assert r.status_code == 200
        body = r.json()
        offender = _contains_secret(body)
        assert offender is None, f"Sensitive field '{offender}' leaked in /api/users response"
        # Also assert raw body text does not contain a "password": pattern
        assert '"password"' not in r.text, "raw response text contains a password key"

    def test_get_users_security_headers(self, session):
        r = session.get(f"{API}/users")
        h = {k.lower(): v for k, v in r.headers.items()}
        required = [
            "strict-transport-security",
            "x-frame-options",
            "x-content-type-options",
            "content-security-policy",
            "referrer-policy",
            "permissions-policy",
        ]
        missing = [k for k in required if k not in h]
        assert not missing, f"Missing security headers: {missing}"


# --------------------------------------------------------------------------- #
# /api/auth/simple-login - admin
# --------------------------------------------------------------------------- #
class TestAdminLogin:
    def test_login_with_email(self, admin_login):
        data = admin_login
        for key in ("id", "name", "email", "phone", "role", "access_token", "token_type"):
            assert key in data, f"Missing '{key}' in login response. Keys: {list(data)}"
        assert data["token_type"].lower() == "bearer"
        assert isinstance(data["access_token"], str) and len(data["access_token"]) > 20
        # JWT format header.payload.signature
        assert data["access_token"].count(".") == 2, "access_token is not a JWT"

    def test_login_response_has_no_password(self, admin_login):
        offender = _contains_secret(admin_login)
        assert offender is None, f"Sensitive field '{offender}' leaked in login response"

    def test_login_with_phone(self, session):
        r = session.post(f"{API}/auth/simple-login",
                         json={"email": ADMIN_PHONE, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "access_token" in data
        assert _contains_secret(data) is None

    def test_wrong_password_returns_401_generic(self, session):
        r = session.post(f"{API}/auth/simple-login",
                         json={"email": ADMIN_EMAIL, "password": "WrongPass@9999"})
        assert r.status_code in (400, 401), f"Got {r.status_code}: {r.text[:200]}"
        text = r.text.lower()
        # Generic detail, no echo of password / stored hash / username
        assert "suraj@262001" not in text
        assert "$2b$" not in text
        assert "bcrypt" not in text


# --------------------------------------------------------------------------- #
# Assistant login
# --------------------------------------------------------------------------- #
class TestAssistantLogin:
    def test_login_with_phone(self, session):
        r = session.post(f"{API}/auth/simple-login",
                         json={"email": ASSISTANT_PHONE, "password": ASSISTANT_PASSWORD})
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("role") == "assistant", f"unexpected role: {data.get('role')}"
        assert "access_token" in data and data["access_token"].count(".") == 2
        assert _contains_secret(data) is None

    def test_login_with_email(self, session):
        r = session.post(f"{API}/auth/simple-login",
                         json={"email": ASSISTANT_EMAIL, "password": ASSISTANT_PASSWORD})
        # email may or may not exist; if 200, validate; otherwise skip
        if r.status_code != 200:
            pytest.skip(f"assistant email login returned {r.status_code}")
        data = r.json()
        assert _contains_secret(data) is None


# --------------------------------------------------------------------------- #
# Bcrypt migration check (subsequent logins still work).
# --------------------------------------------------------------------------- #
class TestBcryptMigration:
    def test_admin_login_twice_still_works(self, session):
        r1 = session.post(f"{API}/auth/simple-login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r1.status_code == 200
        r2 = session.post(f"{API}/auth/simple-login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r2.status_code == 200, "second login failed - bcrypt verify regressed"

    def test_stored_password_is_bcrypt_in_db(self, admin_login):
        """Check MongoDB directly to confirm password starts with $2b$."""
        try:
            from pymongo import MongoClient
        except ImportError:
            pytest.skip("pymongo not installed")
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if not mongo_url:
            # Try backend/.env
            try:
                with open("/app/backend/.env") as f:
                    for line in f:
                        if line.startswith("MONGO_URL="):
                            mongo_url = line.split("=", 1)[1].strip().strip('"')
                        elif line.startswith("DB_NAME="):
                            db_name = line.split("=", 1)[1].strip().strip('"')
            except FileNotFoundError:
                pass
        if not mongo_url or not db_name:
            pytest.skip("MONGO_URL/DB_NAME not available")
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
        try:
            user = client[db_name].users.find_one({"email": {"$regex": f"^{re.escape(ADMIN_EMAIL)}$", "$options": "i"}})
            assert user is not None, "admin user not found in DB"
            stored = user.get("password", "")
            assert stored.startswith(("$2a$", "$2b$", "$2y$")), \
                f"Admin password NOT bcrypt-hashed in DB. Starts with: {stored[:8]!r}"
        finally:
            client.close()


# --------------------------------------------------------------------------- #
# Token usage - smoke check: any protected route
# --------------------------------------------------------------------------- #
class TestBearerToken:
    def test_token_is_valid_jwt(self, admin_login):
        token = admin_login["access_token"]
        parts = token.split(".")
        assert len(parts) == 3, "token is not a valid JWT structure"

    def test_unauthenticated_mutation_status(self, session):
        """Note: in the current code base, no mutation endpoint uses the
        get_current_user dep — endpoints are open. This test documents that
        without changing business logic. We just record the behaviour."""
        # Attempt a write without token to see current behaviour.
        r = session.post(f"{API}/customers", json={
            "name": "TEST_security_probe",
            "phone": "+910000000000",
            "address": "x",
        })
        # We don't assert 401 because endpoints are not yet gated. Just record.
        assert r.status_code in (200, 201, 400, 401, 403, 422), \
            f"unexpected status {r.status_code}: {r.text[:200]}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
