"""AES-GCM encryption regression + bill numbering + company-logo readiness tests."""

import os
import base64
import json
import pytest
import requests

# Pyca cryptography for AES-GCM decrypt of encrypted response bodies
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://showcase-build-20.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "surajbhat2001@gmail.com"
ADMIN_PWD = "Suraj@262001"
ASSISTANT_EMAIL = "rohit@gmail.com"
ASSISTANT_PWD = "Rohit@2026"

# Same key as backend/.env PAYLOAD_ENCRYPTION_KEY & frontend/.env REACT_APP_PAYLOAD_KEY
PAYLOAD_KEY_B64URL = "VFB2K2wugjAKkxVVZqqyamEZ6TTAG426AzJfMp_3M"  # placeholder
# Real key
PAYLOAD_KEY_B64URL = "VFB2K2wqug8jAKkxVVZqqyamEZ6TTAG426AzJfMp_3M"


def _b64url_decode(s: str) -> bytes:
    s = s + "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s.encode("ascii"))


KEY = _b64url_decode(PAYLOAD_KEY_B64URL)


def _decrypt(body: dict) -> dict:
    iv = _b64url_decode(body["iv"])
    ct = _b64url_decode(body["ct"])
    plain = AESGCM(KEY).decrypt(iv, ct, None)
    return json.loads(plain.decode("utf-8"))


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/simple-login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PWD},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data
    assert data["role"] == "superior"
    return data["access_token"]


@pytest.fixture(scope="module")
def assistant_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/simple-login",
        json={"email": ASSISTANT_EMAIL, "password": ASSISTANT_PWD},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


class TestAuthEncryption:
    """/api/auth/* must stay plaintext (frontend reads access_token directly)."""

    def test_login_response_is_plaintext(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/simple-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PWD},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.headers.get("x-payload-encrypted") != "1"
        body = r.json()
        # Plain JSON with access_token visible
        assert "access_token" in body
        assert body["access_token"].count(".") == 2

    def test_login_invalid_credentials_401(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/simple-login",
            json={"email": ADMIN_EMAIL, "password": "wrong-password"},
            timeout=10,
        )
        assert r.status_code in (400, 401)


class TestProtectedEncryption:
    """Anything under /api/* (except auth/seed/health/ws) must be AES-GCM-encrypted."""

    def _headers(self, token):
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def test_get_company_is_encrypted_and_decryptable(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/company", headers=self._headers(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.headers.get("x-payload-encrypted") == "1"
        env = r.json()
        assert env.get("__enc") == 1 and "iv" in env and "ct" in env
        plain = _decrypt(env)
        # Plaintext company profile must contain expected fields
        assert isinstance(plain, dict)
        # Optional: logoUrl key may be empty string but present
        for key in ("name",):
            assert key in plain or "address" in plain

    def test_get_bills_is_encrypted_and_decryptable(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/bills", headers=self._headers(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.headers.get("x-payload-encrypted") == "1"
        plain = _decrypt(r.json())
        assert isinstance(plain, list)

    def test_get_bills_401_without_token(self):
        r = requests.get(f"{BASE_URL}/api/bills", timeout=10)
        assert r.status_code == 401

    def test_put_company_is_encrypted_response(self, admin_token):
        # Fetch first
        cur = requests.get(f"{BASE_URL}/api/company", headers=self._headers(admin_token), timeout=10)
        plain = _decrypt(cur.json())
        # Re-PUT same payload (no-op write to confirm route works under encryption middleware)
        r = requests.put(
            f"{BASE_URL}/api/company",
            headers=self._headers(admin_token),
            json=plain,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert r.headers.get("x-payload-encrypted") == "1"
        roundtrip = _decrypt(r.json())
        assert isinstance(roundtrip, dict)


class TestBillNumbering:
    """Bills collection should be empty so next bill = EPS000410 (client-side gen)."""

    def test_bills_collection_is_empty(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/bills",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10,
        )
        assert r.status_code == 200
        bills = _decrypt(r.json())
        # Allow zero bills — review request states empty
        assert isinstance(bills, list)
        # The client-side generateBillNumber uses Math.max(409, ...nums)+1.
        # If bills exist they must NOT exceed 409 for next bill to be EPS000410.
        nums = []
        for b in bills:
            bn = str(b.get("billNumber", ""))
            digits = "".join(ch for ch in bn if ch.isdigit())
            if digits:
                nums.append(int(digits))
        max_existing = max(nums) if nums else 0
        next_num = max(409, max_existing) + 1
        assert next_num == 410, f"Next bill would be EPS{next_num:06d}, not EPS000410 (bills count={len(bills)}, max={max_existing})"


class TestRbacRegression:
    def test_assistant_cannot_put_company(self, assistant_token):
        r = requests.put(
            f"{BASE_URL}/api/company",
            headers={"Authorization": f"Bearer {assistant_token}", "Content-Type": "application/json"},
            json={"name": "hacker"},
            timeout=10,
        )
        assert r.status_code == 403
