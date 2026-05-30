"""RBAC + sensitive-field leak verification for Eco Pest Solutions API.

Covers the 7-point backend security checklist from the review request:
  1. Unauthenticated requests to protected GETs return 401.
  2. Superior JWT: protected GETs return 200, NO sensitive fields anywhere.
  3. Assistant JWT: Superior-only mutations return 403.
  4. Assistant JWT: protected GETs return 200.
  5. /api/auth/simple-login: has access_token + sanitized user.
  6. /api/auth/magic-link/verify: no sensitive fields.
  7. PUT /api/users/{id}/password: wrong currentPassword rejected, correct one
     accepted and stores bcrypt hash.
"""

from __future__ import annotations

import os
import re
import pytest
import requests

# --- Config ----------------------------------------------------------------- #
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
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
ADMIN_PASSWORD = "Suraj@262001"
ASSISTANT_PHONE = "+918105004458"
ASSISTANT_EMAIL = "rohit@gmail.com"
ASSISTANT_PASSWORD = "Rohit@2026"

SECRET_KEYS = {
    "password", "password_hash", "hashed_password", "firebase_uid",
    "passwordResetToken", "passwordResetExpiry",
    "resetToken", "resetTokenExpiry",
    "otp", "otpExpiry", "magic_link_token", "magicLinkToken",
}

PROTECTED_GETS = ["/users", "/customers", "/bills", "/services",
                  "/company", "/notifications"]


def _find_secret(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in SECRET_KEYS:
                return k
            found = _find_secret(v)
            if found:
                return found
    elif isinstance(obj, list):
        for it in obj:
            found = _find_secret(it)
            if found:
                return found
    return None


# --- Fixtures --------------------------------------------------------------- #
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_data(session):
    r = session.post(f"{API}/auth/simple-login",
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:300]}"
    return r.json()


@pytest.fixture(scope="session")
def assistant_data(session):
    r = session.post(f"{API}/auth/simple-login",
                     json={"email": ASSISTANT_PHONE, "password": ASSISTANT_PASSWORD})
    if r.status_code != 200:
        r = session.post(f"{API}/auth/simple-login",
                         json={"email": ASSISTANT_EMAIL, "password": ASSISTANT_PASSWORD})
    assert r.status_code == 200, f"assistant login failed: {r.status_code} {r.text[:300]}"
    return r.json()


@pytest.fixture(scope="session")
def admin_hdr(admin_data):
    return {"Authorization": f"Bearer {admin_data['access_token']}"}


@pytest.fixture(scope="session")
def assistant_hdr(assistant_data):
    return {"Authorization": f"Bearer {assistant_data['access_token']}"}


# --- 1. Unauthenticated GETs must be 401 ------------------------------------ #
class TestNoAuth401:
    @pytest.mark.parametrize("path", PROTECTED_GETS)
    def test_get_without_token_returns_401(self, session, path):
        r = requests.get(f"{API}{path}")  # fresh session, no headers
        assert r.status_code == 401, \
            f"GET {path} without auth returned {r.status_code} (expected 401). Body: {r.text[:200]}"


# --- 2. Superior JWT: GETs return 200, no sensitive fields ------------------ #
class TestSuperiorAccess:
    @pytest.mark.parametrize("path", PROTECTED_GETS)
    def test_get_with_superior_returns_200(self, session, admin_hdr, path):
        r = session.get(f"{API}{path}", headers=admin_hdr)
        assert r.status_code == 200, \
            f"GET {path} as Superior returned {r.status_code}. Body: {r.text[:200]}"

    @pytest.mark.parametrize("path", PROTECTED_GETS)
    def test_no_sensitive_field_in_response(self, session, admin_hdr, path):
        r = session.get(f"{API}{path}", headers=admin_hdr)
        if r.status_code != 200:
            pytest.skip(f"endpoint {path} not 200 ({r.status_code})")
        try:
            body = r.json()
        except ValueError:
            pytest.skip(f"non-JSON body on {path}")
        offender = _find_secret(body)
        assert offender is None, \
            f"Sensitive field '{offender}' leaked in GET {path} response"

    def test_users_endpoint_no_password_in_raw_text(self, session, admin_hdr):
        r = session.get(f"{API}/users", headers=admin_hdr)
        assert r.status_code == 200
        assert '"password"' not in r.text
        assert '"firebase_uid"' not in r.text
        assert '"resetToken"' not in r.text


# --- 3. Assistant JWT: Superior-only mutations return 403 ------------------- #
class TestAssistantForbidden:
    def test_post_users_forbidden(self, session, assistant_hdr):
        r = session.post(f"{API}/users", headers=assistant_hdr, json={
            "name": "TEST_should_fail", "email": "TEST_fail@example.com",
            "phone": "+919000000000", "password": "x", "role": "assistant",
        })
        assert r.status_code == 403, f"got {r.status_code}: {r.text[:200]}"

    def test_put_users_forbidden(self, session, assistant_hdr, admin_data):
        # use admin's id as the target — assistant should be blocked before any data op
        target = admin_data["id"]
        r = session.put(f"{API}/users/{target}", headers=assistant_hdr,
                        json={"name": "TEST_blocked"})
        assert r.status_code == 403, f"got {r.status_code}: {r.text[:200]}"

    def test_delete_users_forbidden(self, session, assistant_hdr, admin_data):
        target = admin_data["id"]
        r = session.delete(f"{API}/users/{target}", headers=assistant_hdr)
        assert r.status_code == 403, f"got {r.status_code}: {r.text[:200]}"

    def test_patch_role_forbidden(self, session, assistant_hdr, admin_data):
        target = admin_data["id"]
        # spec says PUT, but server uses PATCH — try both
        r_put = session.put(f"{API}/users/{target}/role", headers=assistant_hdr,
                            json={"role": "superior"})
        r_patch = session.patch(f"{API}/users/{target}/role", headers=assistant_hdr,
                                json={"role": "superior"})
        # Whichever verb exists must return 403 (the other returns 405). At least one must be 403.
        assert 403 in (r_put.status_code, r_patch.status_code), \
            f"role-change not gated: PUT={r_put.status_code}, PATCH={r_patch.status_code}"

    def test_create_assistant_forbidden(self, session, assistant_hdr):
        r = session.post(f"{API}/auth/create-assistant", headers=assistant_hdr, json={
            "name": "TEST_blocked", "email": "TEST_blocked@example.com",
            "phone": "+919000000001", "password": "Test@1234",
        })
        assert r.status_code == 403, f"got {r.status_code}: {r.text[:200]}"

    def test_put_company_forbidden(self, session, assistant_hdr):
        r = session.put(f"{API}/company", headers=assistant_hdr,
                        json={"company_name": "TEST_blocked"})
        assert r.status_code == 403, f"got {r.status_code}: {r.text[:200]}"

    def test_put_services_forbidden(self, session, assistant_hdr):
        r = session.put(f"{API}/services", headers=assistant_hdr,
                        json={"services": []})
        assert r.status_code == 403, f"got {r.status_code}: {r.text[:200]}"


# --- 4. Assistant JWT: GETs return 200 -------------------------------------- #
class TestAssistantReadAccess:
    @pytest.mark.parametrize("path", ["/customers", "/bills", "/services", "/company", "/users"])
    def test_get_with_assistant_returns_200(self, session, assistant_hdr, path):
        r = session.get(f"{API}{path}", headers=assistant_hdr)
        assert r.status_code == 200, \
            f"GET {path} as Assistant returned {r.status_code}: {r.text[:200]}"


# --- 5. Login response sanity ----------------------------------------------- #
class TestLoginResponse:
    def test_simple_login_has_token_and_clean_user(self, admin_data):
        assert "access_token" in admin_data
        assert isinstance(admin_data["access_token"], str)
        assert admin_data["access_token"].count(".") == 2
        # No password field anywhere
        assert _find_secret(admin_data) is None
        # Either flattened user OR nested under "user"
        user = admin_data.get("user", admin_data)
        for k in ("id", "name", "email", "role"):
            assert k in user, f"missing '{k}' in login response user"


# --- 6. Magic-link verify response no sensitive fields ---------------------- #
class TestMagicLink:
    def test_magic_link_verify_invalid_token_no_leak(self, session):
        # We don't have a valid token; just confirm the error response itself
        # never includes secret fields (defensive check on shape).
        r = session.post(f"{API}/auth/magic-link/verify",
                         json={"token": "invalid-token-for-shape-check"})
        # Error case — but body must still not leak secrets.
        try:
            body = r.json()
        except ValueError:
            body = {"raw": r.text}
        offender = _find_secret(body)
        assert offender is None, \
            f"Sensitive field '{offender}' present in magic-link/verify error body"


# --- 7. Password change endpoint -------------------------------------------- #
class TestPasswordChange:
    """Use the assistant account to test password change (we restore the
    password at end of class to keep test idempotent)."""

    def test_wrong_current_password_rejected(self, session, assistant_hdr, assistant_data):
        r = session.put(f"{API}/users/{assistant_data['id']}/password",
                        headers=assistant_hdr,
                        json={"current_password": "WrongPassword@123",
                              "new_password": "AnotherPass@456"})
        assert r.status_code in (400, 401, 403), \
            f"wrong currentPassword accepted with {r.status_code}: {r.text[:200]}"

    def test_correct_current_password_accepted_and_bcrypt_stored(self, session, assistant_hdr, assistant_data):
        new_pw = "Rohit@2026Temp1"
        # Change password
        r = session.put(f"{API}/users/{assistant_data['id']}/password",
                        headers=assistant_hdr,
                        json={"current_password": ASSISTANT_PASSWORD,
                              "new_password": new_pw})
        assert r.status_code in (200, 204), \
            f"correct currentPassword rejected with {r.status_code}: {r.text[:200]}"

        # Verify it works
        r2 = session.post(f"{API}/auth/simple-login",
                          json={"email": ASSISTANT_PHONE, "password": new_pw})
        assert r2.status_code == 200, "new password does not authenticate"

        # Verify bcrypt in DB
        try:
            from pymongo import MongoClient
            mongo_url = None
            db_name = None
            with open("/app/backend/.env") as f:
                for line in f:
                    if line.startswith("MONGO_URL="):
                        mongo_url = line.split("=", 1)[1].strip().strip('"')
                    elif line.startswith("DB_NAME="):
                        db_name = line.split("=", 1)[1].strip().strip('"')
            client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
            user = client[db_name].users.find_one({"id": assistant_data["id"]})
            stored = user.get("password", "") if user else ""
            assert stored.startswith(("$2a$", "$2b$", "$2y$")), \
                f"new password not bcrypt-hashed: starts with {stored[:8]!r}"
            client.close()
        except ImportError:
            pass

        # Restore original
        new_hdr = {"Authorization": f"Bearer {r2.json()['access_token']}"}
        r3 = session.put(f"{API}/users/{assistant_data['id']}/password",
                         headers=new_hdr,
                         json={"current_password": new_pw,
                               "new_password": ASSISTANT_PASSWORD})
        assert r3.status_code in (200, 204), \
            f"restore failed: {r3.status_code} {r3.text[:200]}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
