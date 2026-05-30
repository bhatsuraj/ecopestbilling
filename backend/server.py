from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import logging
import secrets
import asyncio
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
import uuid
from datetime import datetime, timezone, timedelta

# Import models
from models import (
    User, UserCreate,
    Customer, CustomerCreate,
    Bill, BillCreate,
    CompanyProfile, CompanyProfileUpdate,
    Notification, NotificationCreate,
)
from firebase_helper import init_firebase, verify_id_token
from security import (
    sanitize_user,
    sanitize_users,
    hash_password,
    verify_password,
    is_legacy_password,
    create_access_token,
    build_get_current_user,
    build_require_superior,
    SecurityHeadersMiddleware,
)


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection — strict reads from env (fail fast on missing config)
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'billing_db')]

# Collections
users_collection = db['users']
customers_collection = db['customers']
bills_collection = db['bills']
company_collection = db['company']
notifications_collection = db['notifications']
services_collection = db['services']

# ---------------------------------------------------------------------------
# SECURITY: User-projection helpers
# Every read that returns a user (or list of users) to the API MUST go
# through these so password / firebase_uid / reset tokens never leave the
# server in any response body. Centralising this prevents drift between
# endpoints.
# ---------------------------------------------------------------------------
_USER_SAFE_PROJECTION = {
    "_id": 0,
    "password": 0,
    "firebase_uid": 0,
    "passwordResetToken": 0,
    "passwordResetExpiry": 0,
}

_USER_SECRET_FIELDS = (
    "password",
    "firebase_uid",
    "passwordResetToken",
    "passwordResetExpiry",
    "_id",
)


def _strip_user_secrets(doc):
    """Defense-in-depth: even if a caller forgot the projection, this
    removes secret fields before serialising the user back to the client."""
    if not doc:
        return doc
    if isinstance(doc, list):
        return [_strip_user_secrets(x) for x in doc]
    return {k: v for k, v in doc.items() if k not in _USER_SECRET_FIELDS}


# ---------------------------------------------------------------------------
# SECURITY: JWT auth + RBAC dependencies
# `current_user_dep` rejects any request without a valid Bearer JWT.
# `require_superior_dep` additionally rejects assistants — used to gate user
# management, company profile edits, and the services catalogue.
# ---------------------------------------------------------------------------
current_user_dep = build_get_current_user(users_collection)
require_superior_dep = build_require_superior(current_user_dep)


# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# WebSocket Connection Manager — real-time mutation broadcasts to all clients.
# Every POST/PUT/DELETE on a tracked collection calls notify(scope, action)
# which pushes a tiny JSON payload {scope, action, at} to every live socket.
# Frontends use this as a nudge to re-fetch only the affected collection.
# ---------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self.active.append(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            if ws in self.active:
                self.active.remove(ws)

    async def broadcast(self, payload: Dict[str, Any]) -> None:
        # Copy the list so concurrent disconnects don't mutate it mid-iteration.
        async with self._lock:
            sockets = list(self.active)
        dead: List[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    if ws in self.active:
                        self.active.remove(ws)


ws_manager = ConnectionManager()


def notify(scope: str, action: str = "update") -> None:
    """Fire-and-forget broadcast. Safe to call from any sync/async path that's
    running inside the FastAPI event loop (every route handler is async)."""
    payload = {
        "scope": scope,
        "action": action,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        asyncio.create_task(ws_manager.broadcast(payload))
    except RuntimeError:
        # No running loop — extremely unlikely inside FastAPI; just drop.
        pass


@api_router.websocket("/ws")
async def realtime_ws(websocket: WebSocket):
    """Real-time mutation feed. Clients connect and listen — they may also
    send 'ping' frames as keepalive. The server replies with a small JSON
    keepalive every 25 s so silently half-closed connections get detected
    and pruned by the next broadcast cycle."""
    await ws_manager.connect(websocket)

    async def server_heartbeat():
        # Lightweight server-initiated keepalive. If send fails the outer
        # broadcast prune will reap this socket on the next mutation.
        while True:
            await asyncio.sleep(25)
            try:
                await websocket.send_json({"scope": "_heartbeat", "at": datetime.now(timezone.utc).isoformat()})
            except Exception:
                break

    heartbeat_task = asyncio.create_task(server_heartbeat())
    try:
        while True:
            # Drain anything the client sends (incl. 'ping') so the proxy
            # sees inbound traffic and stays open.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        heartbeat_task.cancel()
        await ws_manager.disconnect(websocket)


def _ensure_str_id(doc: dict) -> dict:
    """Coerce frontend-supplied numeric ids (e.g. Date.now()) to string,
    or generate a UUID if missing. Mutates and returns the dict."""
    raw = doc.get("id")
    if raw is None or raw == "" or raw == 0:
        doc["id"] = str(uuid.uuid4())
    else:
        doc["id"] = str(raw)
    return doc


# Strong password rule: min 8 chars with a mix of letters, numbers and at
# least one special character from @!#$%^&*().
_PASSWORD_SPECIALS = "@!#$%^&*()"
_PASSWORD_RE = re.compile(
    r"^(?=.*[A-Za-z])(?=.*\d)(?=.*[" + re.escape(_PASSWORD_SPECIALS) + r"]).{8,}$"
)


def _validate_password(password: str) -> None:
    """Raise HTTP 400 if the password doesn't meet the strength policy."""
    if not _PASSWORD_RE.match(password or ""):
        raise HTTPException(
            status_code=400,
            detail=(
                "Password must be at least 8 characters and include letters, "
                "numbers, and a special character (e.g. @ ! #)."
            ),
        )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "Eco Pest Solutions Billing API", "status": "ok"}


# ---------------------------------------------------------------------------
# Startup - Initialize Firebase only (no seed users)
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def on_startup():
    # Initialize Firebase Admin SDK so we can verify ID tokens.
    try:
        init_firebase()
        logging.info("Firebase Admin SDK initialized")
    except Exception as exc:  # noqa: BLE001
        logging.error("Firebase Admin init failed: %s", exc)


# ==================== FIREBASE AUTH ENDPOINTS ====================

bearer_scheme = HTTPBearer(auto_error=False)


class FirebaseLoginBody(BaseModel):
    """Body of POST /api/auth/firebase.

    The frontend MUST send the Firebase ID token (NOT the user's UID).
    Optional `name` / `phone` help populate first-time records.
    """
    id_token: str
    name: Optional[str] = None
    phone: Optional[str] = None


@api_router.post("/auth/firebase")
async def firebase_login(body: FirebaseLoginBody):
    """Verify Firebase ID token → upsert MongoDB user → return app user record.

    The flow:
      1. Frontend signs in with Firebase (email link / phone OTP)
      2. Frontend grabs the ID token via firebaseUser.getIdToken()
      3. Frontend POSTs the token here
      4. Server verifies the token and looks up the MongoDB user by
         firebase_uid OR by email/phone.
      5. If no record exists, server creates one.
         - FIRST USER EVER → role = 'superior' (with employeeId ECO001)
         - SUBSEQUENT USERS → role = 'assistant' (auto-generated employeeId)
    """
    try:
        decoded = verify_id_token(body.id_token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {exc}")

    firebase_uid = decoded.get("uid")
    email = decoded.get("email") or ""
    phone = decoded.get("phone_number") or body.phone or ""
    name = decoded.get("name") or body.name or (email.split("@")[0] if email else "User")

    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Firebase token missing uid")

    # 1. Match by firebase_uid (already linked)
    existing = await users_collection.find_one({"firebase_uid": firebase_uid}, {"_id": 0})

    # 2. Match by email or phone (first-time login)
    if not existing:
        query = {"$or": []}
        if email:
            query["$or"].append({"email": email})
        if phone:
            query["$or"].append({"phone": phone})
        if query["$or"]:
            existing = await users_collection.find_one(query, {"_id": 0})

    if existing:
        # Link firebase_uid + refresh name/phone if missing
        updates = {"firebase_uid": firebase_uid}
        if email and not existing.get("email"):
            updates["email"] = email
        if phone and not existing.get("phone"):
            updates["phone"] = phone
        await users_collection.update_one({"id": existing["id"]}, {"$set": updates})
        existing.update(updates)
        safe = sanitize_user(existing)
        token = create_access_token(existing)
        return {**safe, "access_token": token, "token_type": "bearer"}

    # 3. First-time user → create a new MongoDB record
    # Check if this is the FIRST USER EVER (becomes superior admin)
    total_users = await users_collection.count_documents({})
    is_first_user = total_users == 0
    
    role = "superior" if is_first_user else "assistant"
    employee_id = "ECO001" if is_first_user else f"ECO{str(total_users + 1).zfill(3)}"
    
    new_user = {
        "id": str(uuid.uuid4()),
        "name": name,
        "email": email,
        "phone": phone,
        "password": "",  # Firebase owns auth
        "role": role,
        "employeeId": employee_id,
        "firebase_uid": firebase_uid,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await users_collection.insert_one(dict(new_user))
    
    logging.info(
        f"Created new user: {email or phone} as {role.upper()} (employeeId: {employee_id})"
    )
    
    notify("users", "create")
    return new_user


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """FastAPI dependency — extracts the bearer token, verifies it via Firebase,
    and returns the corresponding MongoDB user. Not used yet, but available
    for any future protected endpoint."""
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        decoded = verify_id_token(creds.credentials)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await users_collection.find_one(
        {"firebase_uid": decoded.get("uid")}, {"_id": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found in app DB")
    return user


# ---------------------------------------------------------------------------
# TEMPORARY: Simple Email/Password Auth (No Firebase)
# ---------------------------------------------------------------------------
class SimpleLoginBody(BaseModel):
    email: str
    password: str


class SimpleRegisterBody(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    password: str


@api_router.get("/auth/superior-exists")
async def superior_exists():
    """Returns whether a Superior Admin has already been registered.
    Used by the public Register page to hide itself once the system is initialised."""
    count = await users_collection.count_documents({"role": "superior"})
    return {"exists": count > 0}


@api_router.post("/auth/simple-register")
async def simple_register(body: SimpleRegisterBody):
    """Public registration endpoint — used ONLY to create the very first Superior Admin.
    
    Once a Superior Admin exists, this endpoint is locked and assistants must be
    created from the in-app Admin Management screen (via /auth/create-assistant).
    """
    # Lock the endpoint once a superior already exists
    superior_count = await users_collection.count_documents({"role": "superior"})
    if superior_count > 0:
        raise HTTPException(
            status_code=403,
            detail="Registration is closed. A Superior Admin already exists. Please contact the administrator.",
        )

    email_norm = (body.email or "").strip().lower()
    phone_norm = (body.phone or "").strip()
    _validate_password(body.password)

    # Check if email already exists (paranoia — shouldn't happen on first user)
    existing = await users_collection.find_one(
        {"email": {"$regex": f"^{re.escape(email_norm)}$", "$options": "i"}}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    role = "superior"
    employee_id = "ECO001"

    new_user = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "email": email_norm,
        "phone": phone_norm,
        "password": hash_password(body.password),
        "role": role,
        "employeeId": employee_id,
        "firebase_uid": "",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    await users_collection.insert_one(dict(new_user))

    logging.info(
        f"Simple auth: Created FIRST user {email_norm} as {role.upper()} ({employee_id})"
    )

    notify("users", "create")
    return {"message": "Registration successful", "role": role, "employeeId": employee_id}


@api_router.post("/auth/create-assistant")
async def create_assistant(
    body: SimpleRegisterBody,
    _superior: dict = Depends(require_superior_dep),
):
    """Create an Assistant Admin. Restricted to authenticated Superior admins."""
    superior_count = await users_collection.count_documents({"role": "superior"})
    if superior_count == 0:
        raise HTTPException(
            status_code=400,
            detail="No Superior Admin exists yet. Please register the first user via the Register page.",
        )

    email_norm = (body.email or "").strip().lower()
    phone_norm = (body.phone or "").strip()
    _validate_password(body.password)

    existing = await users_collection.find_one(
        {"email": {"$regex": f"^{re.escape(email_norm)}$", "$options": "i"}}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Reject duplicate phone numbers (compare last 10 digits so +91 vs raw 10-digit
    # representations are matched consistently).
    phone_tail = re.sub(r"\D", "", phone_norm)[-10:]
    if phone_tail:
        async for u in users_collection.find({}, {"_id": 0, "phone": 1}):
            other_tail = re.sub(r"\D", "", str(u.get("phone") or ""))[-10:]
            if other_tail and other_tail == phone_tail:
                raise HTTPException(status_code=400, detail="Phone number already registered")

    total_users = await users_collection.count_documents({})
    employee_id = f"ECO{str(total_users + 1).zfill(3)}"

    new_user = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "email": email_norm,
        "phone": phone_norm,
        "password": hash_password(body.password),
        "role": "assistant",
        "employeeId": employee_id,
        "firebase_uid": "",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    await users_collection.insert_one(dict(new_user))
    logging.info(f"Admin: Created assistant {email_norm} ({employee_id})")
    notify("users", "create")
    return {"message": "Assistant created", "role": "assistant", "employeeId": employee_id}


@api_router.post("/auth/simple-login")
async def simple_login(body: SimpleLoginBody):
    """Login with email OR phone + password.

    The frontend sends the user-typed identifier in the `email` field — we
    detect whether it looks like an email (contains '@') and search the users
    collection accordingly. Emails are matched case-insensitively.
    """
    identifier = (body.email or "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Email or phone is required")

    if "@" in identifier:
        # Treat as email — match case-insensitively to support legacy records.
        email_lc = identifier.lower()
        query = {"email": {"$regex": f"^{re.escape(email_lc)}$", "$options": "i"}}
    else:
        # Treat as phone — match exact, or with leading '+' tolerated
        digits = re.sub(r"\D", "", identifier)
        candidates = {identifier}
        if digits:
            candidates.add(digits)
            candidates.add(f"+{digits}")
        query = {"phone": {"$in": list(candidates)}}

    user = await users_collection.find_one(query, {"_id": 0})

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    stored_pw = user.get("password", "") or ""
    if not verify_password(body.password, stored_pw):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Auto-migrate legacy plaintext passwords → bcrypt on successful login.
    if is_legacy_password(stored_pw):
        try:
            await users_collection.update_one(
                {"id": user["id"]},
                {"$set": {"password": hash_password(body.password)}},
            )
        except Exception as exc:  # noqa: BLE001
            logging.warning("Password rehash failed for %s: %s", identifier, exc)

    logging.info(f"Simple auth: User {identifier} logged in successfully")

    safe_user = sanitize_user(user)
    token = create_access_token(user)
    return {**safe_user, "access_token": token, "token_type": "bearer"}


# ---------------------------------------------------------------------------
# MAGIC LINK: Email Login with Token (No Firebase)
# ---------------------------------------------------------------------------
class MagicLinkRequestBody(BaseModel):
    email: str


class MagicLinkVerifyBody(BaseModel):
    token: str


# In-memory token storage (for demo - use Redis in production)
magic_link_tokens = {}


@api_router.post("/auth/magic-link/request")
async def request_magic_link(body: MagicLinkRequestBody):
    """Generate a magic link token for email login.
    
    For now, returns the link to display on screen.
    Later, can be sent via email service.
    """
    email = body.email.strip().lower()
    
    # Check if user exists
    user = await users_collection.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email. Please register first.")
    
    # Generate secure token
    token = secrets.token_urlsafe(32)
    
    # Store token with expiration (15 minutes)
    magic_link_tokens[token] = {
        "email": email,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    
    # Generate magic link
    frontend_url = os.environ.get("FRONTEND_URL", "https://billing-preview-12.preview.emergentagent.com")
    magic_link = f"{frontend_url}/magic-login?token={token}"
    
    logging.info(f"Magic link generated for {email}")
    
    # TODO: Send via email service (SendGrid, Mailgun, etc.)
    # For now, return the link to display on screen
    
    return {
        "message": "Magic link generated successfully",
        "link": magic_link,
        "expiresIn": "15 minutes",
        "note": "Copy this link and open it in your browser. (Email sending will be added later)"
    }


@api_router.post("/auth/magic-link/verify")
async def verify_magic_link(body: MagicLinkVerifyBody):
    """Verify magic link token and log user in."""
    token = body.token
    
    # Check if token exists
    if token not in magic_link_tokens:
        raise HTTPException(status_code=400, detail="Invalid or expired magic link")
    
    token_data = magic_link_tokens[token]
    
    # Check expiration
    if datetime.now(timezone.utc) > token_data["expires"]:
        del magic_link_tokens[token]
        raise HTTPException(status_code=400, detail="Magic link has expired. Please request a new one.")
    
    # Get user
    user = await users_collection.find_one({"email": token_data["email"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete token (one-time use)
    del magic_link_tokens[token]
    
    logging.info(f"Magic link verified for {token_data['email']}")
    
    safe_user = sanitize_user(user)
    access_token = create_access_token(user)
    return {**safe_user, "access_token": access_token, "token_type": "bearer"}


# ==================== USER ENDPOINTS ====================

@api_router.post("/users", response_model=User)
async def create_user(
    user: UserCreate,
    _superior: dict = Depends(require_superior_dep),
):
    user_dict = user.model_dump()
    _ensure_str_id(user_dict)
    user_dict.setdefault("createdAt", datetime.now(timezone.utc).isoformat())
    if user_dict.get("password"):
        user_dict["password"] = hash_password(user_dict["password"])

    # Upsert by id so re-saving from a stale client doesn't 500.
    await users_collection.update_one(
        {"id": user_dict["id"]},
        {"$set": user_dict},
        upsert=True,
    )
    saved = await users_collection.find_one({"id": user_dict["id"]}, _USER_SAFE_PROJECTION)
    notify("users", "create")
    return User(**sanitize_user(saved))


@api_router.get("/users", response_model=List[User])
async def get_users(_user: dict = Depends(current_user_dep)):
    users = await users_collection.find({}, _USER_SAFE_PROJECTION).to_list(1000)
    return sanitize_users(users)


@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str, _user: dict = Depends(current_user_dep)):
    user = await users_collection.find_one({"id": user_id}, _USER_SAFE_PROJECTION)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return sanitize_user(user)


@api_router.put("/users/{user_id}", response_model=User)
async def update_user(
    user_id: str,
    user: UserCreate,
    _superior: dict = Depends(require_superior_dep),
):
    user_dict = user.model_dump()
    user_dict["id"] = str(user_id)
    # Never overwrite stored bcrypt hash with a blank/plaintext from the form.
    if user_dict.get("password"):
        user_dict["password"] = hash_password(user_dict["password"])
    else:
        user_dict.pop("password", None)
    result = await users_collection.update_one(
        {"id": user_dict["id"]},
        {"$set": user_dict},
        upsert=True,
    )
    if result.matched_count == 0 and not result.upserted_id:
        raise HTTPException(status_code=404, detail="User not found")
    updated_user = await users_collection.find_one({"id": user_dict["id"]}, _USER_SAFE_PROJECTION)
    notify("users", "update")
    return User(**sanitize_user(updated_user))


@api_router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    _superior: dict = Depends(require_superior_dep),
):
    result = await users_collection.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    notify("users", "delete")
    return {"message": "User deleted successfully"}


class RoleChangeBody(BaseModel):
    role: str  # 'superior' or 'assistant'


@api_router.patch("/users/{user_id}/role")
async def change_user_role(
    user_id: str,
    body: RoleChangeBody,
    _superior: dict = Depends(require_superior_dep),
):
    """Change a user's role. Superior-only."""
    if body.role not in ("superior", "assistant"):
        raise HTTPException(status_code=400, detail="Invalid role")
    result = await users_collection.update_one(
        {"id": str(user_id)},
        {"$set": {"role": body.role}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    updated = await users_collection.find_one({"id": str(user_id)}, _USER_SAFE_PROJECTION)
    notify("users", "update")
    return sanitize_user(updated)


class PasswordChangeBody(BaseModel):
    current_password: str
    new_password: str


@api_router.put("/users/{user_id}/password")
async def change_user_password(
    user_id: str,
    body: PasswordChangeBody,
    current_user: dict = Depends(current_user_dep),
):
    """Change a user's password.
    
    Authenticated users may change their OWN password (after verifying their
    current password). Superiors may change anyone's password without
    needing the target user's current password.
    """
    _validate_password(body.new_password)

    user = await users_collection.find_one({"id": str(user_id)}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_self = str(current_user.get("id")) == str(user_id)
    is_superior = (current_user.get("role") or "").lower() == "superior"
    if not is_self and not is_superior:
        raise HTTPException(status_code=403, detail="Forbidden")

    if is_self:
        if not verify_password(body.current_password, user.get("password", "") or ""):
            raise HTTPException(status_code=401, detail="Current password is incorrect")

    await users_collection.update_one(
        {"id": str(user_id)},
        {"$set": {"password": hash_password(body.new_password)}},
    )
    notify("users", "update")
    return {"message": "Password updated successfully"}


# ==================== CUSTOMER ENDPOINTS ====================

@api_router.post("/customers", response_model=Customer)
async def create_customer(
    customer: CustomerCreate,
    _user: dict = Depends(current_user_dep),
):
    customer_dict = customer.model_dump()
    _ensure_str_id(customer_dict)
    customer_dict.setdefault("createdAt", datetime.now(timezone.utc).isoformat())

    await customers_collection.update_one(
        {"id": customer_dict["id"]},
        {"$set": customer_dict},
        upsert=True,
    )
    saved = await customers_collection.find_one({"id": customer_dict["id"]}, {"_id": 0})
    notify("customers", "create")
    return Customer(**saved)


@api_router.get("/customers", response_model=List[Customer])
async def get_customers(_user: dict = Depends(current_user_dep)):
    customers = await customers_collection.find({}, {"_id": 0}).to_list(1000)
    return customers


@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str, _user: dict = Depends(current_user_dep)):
    customer = await customers_collection.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(
    customer_id: str,
    customer: CustomerCreate,
    _user: dict = Depends(current_user_dep),
):
    customer_dict = customer.model_dump()
    customer_dict["id"] = str(customer_id)
    await customers_collection.update_one(
        {"id": customer_dict["id"]},
        {"$set": customer_dict},
        upsert=True,
    )
    updated_customer = await customers_collection.find_one({"id": customer_dict["id"]}, {"_id": 0})
    notify("customers", "update")
    return Customer(**updated_customer)


@api_router.delete("/customers/{customer_id}")
async def delete_customer(
    customer_id: str,
    _user: dict = Depends(current_user_dep),
):
    result = await customers_collection.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    notify("customers", "delete")
    return {"message": "Customer deleted successfully"}


# ==================== BILL ENDPOINTS ====================

@api_router.post("/bills", response_model=Bill)
async def create_bill(bill: BillCreate, _user: dict = Depends(current_user_dep)):
    bill_dict = bill.model_dump()
    _ensure_str_id(bill_dict)
    bill_dict.setdefault("createdAt", datetime.now(timezone.utc).isoformat())

    # Upsert by billNumber (the user-facing unique key)
    await bills_collection.update_one(
        {"billNumber": bill_dict["billNumber"]},
        {"$set": bill_dict},
        upsert=True,
    )
    saved = await bills_collection.find_one({"billNumber": bill_dict["billNumber"]}, {"_id": 0})
    notify("bills", "create")
    return Bill(**saved)


@api_router.get("/bills", response_model=List[Bill])
async def get_bills(_user: dict = Depends(current_user_dep)):
    bills = await bills_collection.find({}, {"_id": 0}).to_list(10000)
    return bills


@api_router.get("/bills/{bill_id}", response_model=Bill)
async def get_bill(bill_id: str, _user: dict = Depends(current_user_dep)):
    bill = await bills_collection.find_one({"id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill


@api_router.get("/bills/number/{bill_number}", response_model=Bill)
async def get_bill_by_number(bill_number: str, _user: dict = Depends(current_user_dep)):
    bill = await bills_collection.find_one({"billNumber": bill_number}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill


@api_router.put("/bills/{bill_id}", response_model=Bill)
async def update_bill(
    bill_id: str,
    bill: BillCreate,
    _user: dict = Depends(current_user_dep),
):
    bill_dict = bill.model_dump()
    bill_dict["id"] = str(bill_id)
    await bills_collection.update_one(
        {"id": bill_dict["id"]},
        {"$set": bill_dict},
        upsert=True,
    )
    updated_bill = await bills_collection.find_one({"id": bill_dict["id"]}, {"_id": 0})
    notify("bills", "update")
    return Bill(**updated_bill)


@api_router.put("/bills/number/{bill_number}", response_model=Bill)
async def update_bill_by_number(
    bill_number: str,
    bill: BillCreate,
    _user: dict = Depends(current_user_dep),
):
    """Upsert by the user-facing billNumber. Used by the frontend sync layer."""
    bill_dict = bill.model_dump()
    bill_dict["billNumber"] = bill_number
    raw_id = bill_dict.get("id")
    if raw_id in (None, "", 0):
        existing = await bills_collection.find_one({"billNumber": bill_number}, {"_id": 0})
        bill_dict["id"] = existing["id"] if existing else str(uuid.uuid4())
    else:
        bill_dict["id"] = str(raw_id)
    bill_dict.setdefault("createdAt", datetime.now(timezone.utc).isoformat())
    await bills_collection.update_one(
        {"billNumber": bill_number},
        {"$set": bill_dict},
        upsert=True,
    )
    updated = await bills_collection.find_one({"billNumber": bill_number}, {"_id": 0})
    notify("bills", "update")
    return Bill(**updated)


@api_router.delete("/bills/{bill_id}")
async def delete_bill(bill_id: str, _user: dict = Depends(current_user_dep)):
    result = await bills_collection.delete_one({"id": bill_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bill not found")
    notify("bills", "delete")
    return {"message": "Bill deleted successfully"}


@api_router.delete("/bills/number/{bill_number}")
async def delete_bill_by_number(
    bill_number: str,
    _user: dict = Depends(current_user_dep),
):
    result = await bills_collection.delete_one({"billNumber": bill_number})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bill not found")
    notify("bills", "delete")
    return {"message": "Bill deleted successfully"}


# ==================== COMPANY PROFILE ENDPOINTS ====================

DEFAULT_COMPANY = {
    "name": "ECO PEST SOLUTIONS",
    "gstNumber": "29DYSPM4565D2ZS",
    "sacCode": "998531",
    "phone": "",
    "email": "mge.ecopestsolutions@gmail.com",
    "website": "www.ecopestsolutions.org",
    "address": "No. 281, Ground floor, 4th cross 3rd main, B-Block, Vijayanandanagar, Nandini Layout Post, Bangalore - 560096",
    "bankHolder": "ECO PEST SOLUTIONS",
    "bankName": "",
    "bankAccount": "",
    "ifscCode": "",
    "micrCode": "",
    "cgst": 9,
    "sgst": 9,
    "logo": "",
}


@api_router.get("/company", response_model=CompanyProfile)
async def get_company_profile(_user: dict = Depends(current_user_dep)):
    company = await company_collection.find_one({}, {"_id": 0})
    if not company:
        return CompanyProfile(**DEFAULT_COMPANY)
    return CompanyProfile(**company)


@api_router.put("/company", response_model=CompanyProfile)
async def update_company_profile(
    company: CompanyProfileUpdate,
    _superior: dict = Depends(require_superior_dep),
):
    company_dict = {k: v for k, v in company.model_dump().items() if v is not None}
    await company_collection.update_one(
        {},
        {"$set": company_dict},
        upsert=True,
    )
    updated_company = await company_collection.find_one({}, {"_id": 0})
    notify("company", "update")
    return CompanyProfile(**updated_company)


# ==================== NOTIFICATION ENDPOINTS ====================

@api_router.post("/notifications", response_model=Notification)
async def create_notification(
    notification: NotificationCreate,
    _user: dict = Depends(current_user_dep),
):
    notification_dict = notification.model_dump()
    _ensure_str_id(notification_dict)
    notification_dict["userId"] = str(notification_dict.get("userId", ""))
    notification_dict.setdefault("createdAt", datetime.now(timezone.utc).isoformat())
    notification_dict.setdefault("read", False)

    await notifications_collection.update_one(
        {"id": notification_dict["id"]},
        {"$set": notification_dict},
        upsert=True,
    )
    saved = await notifications_collection.find_one({"id": notification_dict["id"]}, {"_id": 0})
    notify("notifications", "create")
    return Notification(**saved)


@api_router.get("/notifications", response_model=List[Notification])
async def get_all_notifications(_user: dict = Depends(current_user_dep)):
    notifications = await notifications_collection.find({}, {"_id": 0}).sort("createdAt", -1).to_list(10000)
    return notifications


@api_router.get("/notifications/{user_id}", response_model=List[Notification])
async def get_user_notifications(
    user_id: str,
    current_user: dict = Depends(current_user_dep),
):
    # Users can only read their own notifications; superiors can read anyone's.
    if str(current_user.get("id")) != str(user_id) and (current_user.get("role") or "").lower() != "superior":
        raise HTTPException(status_code=403, detail="Forbidden")
    notifications = await notifications_collection.find(
        {"userId": user_id},
        {"_id": 0},
    ).sort("createdAt", -1).to_list(1000)
    return notifications


@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(current_user_dep),
):
    notif = await notifications_collection.find_one({"id": notification_id}, {"_id": 0})
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    if str(notif.get("userId")) != str(current_user.get("id")) and (current_user.get("role") or "").lower() != "superior":
        raise HTTPException(status_code=403, detail="Forbidden")
    await notifications_collection.update_one(
        {"id": notification_id},
        {"$set": {"read": True}},
    )
    notify("notifications", "update")
    return {"message": "Notification marked as read"}


@api_router.put("/notifications/user/{user_id}/read-all")
async def mark_all_notifications_read(
    user_id: str,
    current_user: dict = Depends(current_user_dep),
):
    if str(current_user.get("id")) != str(user_id) and (current_user.get("role") or "").lower() != "superior":
        raise HTTPException(status_code=403, detail="Forbidden")
    await notifications_collection.update_many(
        {"userId": user_id},
        {"$set": {"read": True}},
    )
    notify("notifications", "update")
    return {"message": "All notifications marked as read"}


@api_router.delete("/notifications/{user_id}")
async def clear_user_notifications(
    user_id: str,
    current_user: dict = Depends(current_user_dep),
):
    if str(current_user.get("id")) != str(user_id) and (current_user.get("role") or "").lower() != "superior":
        raise HTTPException(status_code=403, detail="Forbidden")
    await notifications_collection.delete_many({"userId": user_id})
    notify("notifications", "delete")
    return {"message": "All notifications cleared"}


# ==================== SERVICES ENDPOINTS ====================
# Services are stored as a single bulk collection. The frontend treats them
# as one editable list, so we expose GET (list) + PUT (replace-all).

@api_router.get("/services")
async def get_services(_user: dict = Depends(current_user_dep)) -> List[Dict[str, Any]]:
    services = await services_collection.find({}, {"_id": 0}).to_list(10000)
    return services


@api_router.put("/services")
async def replace_services(
    services: List[Dict[str, Any]],
    _superior: dict = Depends(require_superior_dep),
):
    """Replace the entire services collection with the provided list."""
    await services_collection.delete_many({})
    if services:
        # Strip _id if any client accidentally posted it
        cleaned = [{k: v for k, v in s.items() if k != "_id"} for s in services]
        await services_collection.insert_many(cleaned)
    saved = await services_collection.find({}, {"_id": 0}).to_list(10000)
    notify("services", "update")
    return saved


# ---------------------------------------------------------------------------
# Mount router & middleware
# ---------------------------------------------------------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# OWASP security response headers (HSTS, CSP, X-Frame-Options, etc.)
app.add_middleware(SecurityHeadersMiddleware)

# AES-GCM response payload obfuscation — must be registered LAST so it
# runs FIRST on the response (Starlette middleware stack is LIFO on
# response). This ensures the body is encrypted *after* CORS / security
# headers are written and before it leaves the process.
from payload_middleware import PayloadEncryptionMiddleware  # noqa: E402
app.add_middleware(PayloadEncryptionMiddleware)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
