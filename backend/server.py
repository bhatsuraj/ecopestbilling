
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import asyncio
import logging
import secrets
import base64
import resend
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
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

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


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
    """Verify Firebase ID token → upsert MongoDB user → return app user record."""
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
        return existing

    # 3. First-time user → create a new MongoDB record
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

    return new_user


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """FastAPI dependency — extracts the bearer token, verifies it via Firebase,
    and returns the corresponding MongoDB user."""
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
    """Returns whether a Superior Admin has already been registered."""
    count = await users_collection.count_documents({"role": "superior"})
    return {"exists": count > 0}


@api_router.post("/auth/simple-register")
async def simple_register(body: SimpleRegisterBody):
    """Public registration endpoint — used ONLY to create the very first Superior Admin."""
    superior_count = await users_collection.count_documents({"role": "superior"})
    if superior_count > 0:
        raise HTTPException(
            status_code=403,
            detail="Registration is closed. A Superior Admin already exists. Please contact the administrator.",
        )

    email_norm = (body.email or "").strip().lower()
    phone_norm = (body.phone or "").strip()
    _validate_password(body.password)

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
        "password": body.password,
        "role": role,
        "employeeId": employee_id,
        "firebase_uid": "",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    await users_collection.insert_one(dict(new_user))

    logging.info(
        f"Simple auth: Created FIRST user {email_norm} as {role.upper()} ({employee_id})"
    )

    return {"message": "Registration successful", "role": role, "employeeId": employee_id}


@api_router.post("/auth/create-assistant")
async def create_assistant(body: SimpleRegisterBody):
    """Create an Assistant Admin. Used by the Superior from Admin Management."""
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
        "password": body.password,
        "role": "assistant",
        "employeeId": employee_id,
        "firebase_uid": "",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    await users_collection.insert_one(dict(new_user))
    logging.info(f"Admin: Created assistant {email_norm} ({employee_id})")
    return {"message": "Assistant created", "role": "assistant", "employeeId": employee_id}


@api_router.post("/auth/simple-login")
async def simple_login(body: SimpleLoginBody):
    """Login with email OR phone + password."""
    identifier = (body.email or "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Email or phone is required")

    if "@" in identifier:
        email_lc = identifier.lower()
        query = {"email": {"$regex": f"^{re.escape(email_lc)}$", "$options": "i"}}
    else:
        digits = re.sub(r"\D", "", identifier)
        candidates = {identifier}
        if digits:
            candidates.add(digits)
            candidates.add(f"+{digits}")
        query = {"phone": {"$in": list(candidates)}}

    user = await users_collection.find_one(query, {"_id": 0})

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.get("password") != body.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    logging.info(f"Simple auth: User {identifier} logged in successfully")

    return user


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
    """Generate a magic link token for email login."""
    email = body.email.strip().lower()

    user = await users_collection.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email. Please register first.")

    token = secrets.token_urlsafe(32)

    magic_link_tokens[token] = {
        "email": email,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=15),
    }

    frontend_url = os.environ.get("FRONTEND_URL", "https://ecopestbilling.vercel.app")
    magic_link = f"{frontend_url}/magic-login?token={token}"

    logging.info(f"Magic link generated for {email}")

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

    if token not in magic_link_tokens:
        raise HTTPException(status_code=400, detail="Invalid or expired magic link")

    token_data = magic_link_tokens[token]

    if datetime.now(timezone.utc) > token_data["expires"]:
        del magic_link_tokens[token]
        raise HTTPException(status_code=400, detail="Magic link has expired. Please request a new one.")

    user = await users_collection.find_one({"email": token_data["email"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    del magic_link_tokens[token]

    logging.info(f"Magic link verified for {token_data['email']}")

    return user


# ==================== USER ENDPOINTS ====================

@api_router.post("/users", response_model=User)
async def create_user(user: UserCreate):
    user_dict = user.model_dump()
    _ensure_str_id(user_dict)
    user_dict.setdefault("createdAt", datetime.now(timezone.utc).isoformat())

    await users_collection.update_one(
        {"id": user_dict["id"]},
        {"$set": user_dict},
        upsert=True,
    )
    saved = await users_collection.find_one({"id": user_dict["id"]}, {"_id": 0})
    return User(**saved)


@api_router.get("/users", response_model=List[User])
async def get_users():
    users = await users_collection.find({}, {"_id": 0}).to_list(1000)
    return users


@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    user = await users_collection.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user: UserCreate):
    user_dict = user.model_dump()
    user_dict["id"] = str(user_id)
    result = await users_collection.update_one(
        {"id": user_dict["id"]},
        {"$set": user_dict},
        upsert=True,
    )
    if result.matched_count == 0 and not result.upserted_id:
        raise HTTPException(status_code=404, detail="User not found")
    updated_user = await users_collection.find_one({"id": user_dict["id"]}, {"_id": 0})
    return User(**updated_user)


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    result = await users_collection.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}


class RoleChangeBody(BaseModel):
    role: str  # 'superior' or 'assistant'


@api_router.patch("/users/{user_id}/role")
async def change_user_role(user_id: str, body: RoleChangeBody):
    """Change a user's role. Used by Admin Management."""
    if body.role not in ("superior", "assistant"):
        raise HTTPException(status_code=400, detail="Invalid role")
    result = await users_collection.update_one(
        {"id": str(user_id)},
        {"$set": {"role": body.role}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    updated = await users_collection.find_one({"id": str(user_id)}, {"_id": 0})
    return updated


class PasswordChangeBody(BaseModel):
    current_password: str
    new_password: str


@api_router.put("/users/{user_id}/password")
async def change_user_password(user_id: str, body: PasswordChangeBody):
    """Change the password for a user. Verifies the current password first."""
    _validate_password(body.new_password)

    user = await users_collection.find_one({"id": str(user_id)}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("password", "") != body.current_password:
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    await users_collection.update_one(
        {"id": str(user_id)},
        {"$set": {"password": body.new_password}},
    )
    return {"message": "Password updated successfully"}


# ==================== CUSTOMER ENDPOINTS ====================

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate):
    customer_dict = customer.model_dump()
    _ensure_str_id(customer_dict)
    customer_dict.setdefault("createdAt", datetime.now(timezone.utc).isoformat())

    await customers_collection.update_one(
        {"id": customer_dict["id"]},
        {"$set": customer_dict},
        upsert=True,
    )
    saved = await customers_collection.find_one({"id": customer_dict["id"]}, {"_id": 0})
    return Customer(**saved)


@api_router.get("/customers", response_model=List[Customer])
async def get_customers():
    customers = await customers_collection.find({}, {"_id": 0}).to_list(1000)
    return customers


@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str):
    customer = await customers_collection.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer: CustomerCreate):
    customer_dict = customer.model_dump()
    customer_dict["id"] = str(customer_id)
    await customers_collection.update_one(
        {"id": customer_dict["id"]},
        {"$set": customer_dict},
        upsert=True,
    )
    updated_customer = await customers_collection.find_one({"id": customer_dict["id"]}, {"_id": 0})
    return Customer(**updated_customer)


@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    result = await customers_collection.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted successfully"}


# ==================== BILL ENDPOINTS ====================

@api_router.post("/bills", response_model=Bill)
async def create_bill(bill: BillCreate):
    bill_dict = bill.model_dump()
    _ensure_str_id(bill_dict)
    bill_dict.setdefault("createdAt", datetime.now(timezone.utc).isoformat())

    await bills_collection.update_one(
        {"billNumber": bill_dict["billNumber"]},
        {"$set": bill_dict},
        upsert=True,
    )
    saved = await bills_collection.find_one({"billNumber": bill_dict["billNumber"]}, {"_id": 0})
    return Bill(**saved)


@api_router.get("/bills", response_model=List[Bill])
async def get_bills():
    bills = await bills_collection.find({}, {"_id": 0}).to_list(10000)
    return bills


@api_router.get("/bills/{bill_id}", response_model=Bill)
async def get_bill(bill_id: str):
    bill = await bills_collection.find_one({"id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill


@api_router.get("/bills/number/{bill_number}", response_model=Bill)
async def get_bill_by_number(bill_number: str):
    bill = await bills_collection.find_one({"billNumber": bill_number}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill


@api_router.put("/bills/{bill_id}", response_model=Bill)
async def update_bill(bill_id: str, bill: BillCreate):
    bill_dict = bill.model_dump()
    bill_dict["id"] = str(bill_id)
    await bills_collection.update_one(
        {"id": bill_dict["id"]},
        {"$set": bill_dict},
        upsert=True,
    )
    updated_bill = await bills_collection.find_one({"id": bill_dict["id"]}, {"_id": 0})
    return Bill(**updated_bill)


@api_router.put("/bills/number/{bill_number}", response_model=Bill)
async def update_bill_by_number(bill_number: str, bill: BillCreate):
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
    return Bill(**updated)


@api_router.delete("/bills/{bill_id}")
async def delete_bill(bill_id: str):
    result = await bills_collection.delete_one({"id": bill_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bill not found")
    return {"message": "Bill deleted successfully"}


@api_router.delete("/bills/number/{bill_number}")
async def delete_bill_by_number(bill_number: str):
    result = await bills_collection.delete_one({"billNumber": bill_number})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bill not found")
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
async def get_company_profile():
    company = await company_collection.find_one({}, {"_id": 0})
    if not company:
        return CompanyProfile(**DEFAULT_COMPANY)
    return CompanyProfile(**company)


@api_router.put("/company", response_model=CompanyProfile)
async def update_company_profile(company: CompanyProfileUpdate):
    company_dict = {k: v for k, v in company.model_dump().items() if v is not None}
    await company_collection.update_one(
        {},
        {"$set": company_dict},
        upsert=True,
    )
    updated_company = await company_collection.find_one({}, {"_id": 0})
    return CompanyProfile(**updated_company)


# ==================== NOTIFICATION ENDPOINTS ====================

@api_router.post("/notifications", response_model=Notification)
async def create_notification(notification: NotificationCreate):
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
    return Notification(**saved)


@api_router.get("/notifications", response_model=List[Notification])
async def get_all_notifications():
    notifications = await notifications_collection.find({}, {"_id": 0}).sort("createdAt", -1).to_list(10000)
    return notifications


@api_router.get("/notifications/{user_id}", response_model=List[Notification])
async def get_user_notifications(user_id: str):
    notifications = await notifications_collection.find(
        {"userId": user_id},
        {"_id": 0},
    ).sort("createdAt", -1).to_list(1000)
    return notifications


@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    result = await notifications_collection.update_one(
        {"id": notification_id},
        {"$set": {"read": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}


@api_router.put("/notifications/user/{user_id}/read-all")
async def mark_all_notifications_read(user_id: str):
    await notifications_collection.update_many(
        {"userId": user_id},
        {"$set": {"read": True}},
    )
    return {"message": "All notifications marked as read"}


@api_router.delete("/notifications/{user_id}")
async def clear_user_notifications(user_id: str):
    await notifications_collection.delete_many({"userId": user_id})
    return {"message": "All notifications cleared"}


# ==================== SERVICES ENDPOINTS ====================

@api_router.get("/services")
async def get_services() -> List[Dict[str, Any]]:
    services = await services_collection.find({}, {"_id": 0}).to_list(10000)
    return services


@api_router.put("/services")
async def replace_services(services: List[Dict[str, Any]]):
    """Replace the entire services collection with the provided list."""
    await services_collection.delete_many({})
    if services:
        cleaned = [{k: v for k, v in s.items() if k != "_id"} for s in services]
        await services_collection.insert_many(cleaned)
    saved = await services_collection.find({}, {"_id": 0}).to_list(10000)
    return saved


# ---------------------------------------------------------------------------
# Email (Resend HTTP API) — used by the invoice "Share → Email" flow so the
# customer receives the PDF as a real attachment. Uses Resend instead of raw
# SMTP because Render's free tier blocks outbound SMTP ports (25/465/587).
# Auth is via RESEND_API_KEY stored in backend/.env (or Render dashboard env).
# ---------------------------------------------------------------------------
class SendBillEmailBody(BaseModel):
    to: EmailStr
    subject: str
    body: str
    pdfBase64: str
    filename: Optional[str] = "invoice.pdf"


@api_router.post("/bills/send-email")
async def send_bill_email(payload: SendBillEmailBody):
    """Send an invoice email with the PDF attached via Resend HTTP API.

    Reads RESEND_API_KEY and SENDER_EMAIL from environment variables. Returns
    500 with a descriptive error if the email could not be delivered (caller
    surfaces it in the share modal).
    """
    api_key = os.environ.get("RESEND_API_KEY", "")
    sender_email = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    from_name = os.environ.get("SENDER_NAME", "Eco Pest Solutions")

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Email not configured. Missing RESEND_API_KEY on the server.",
        )

    # Decode the PDF (frontend sends raw base64, no data: prefix expected,
    # but tolerate it just in case).
    b64 = payload.pdfBase64 or ""
    if b64.startswith("data:"):
        comma = b64.find(",")
        if comma != -1:
            b64 = b64[comma + 1:]
    # Strip whitespace/newlines defensively.
    b64 = re.sub(r"\s+", "", b64)
    try:
        pdf_bytes = base64.b64decode(b64, validate=False)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid PDF payload (base64 decode failed).")

    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Empty PDF payload.")

    # Sanitize filename.
    safe_name = re.sub(r"[\r\n]+", "_", payload.filename or "invoice.pdf").strip() or "invoice.pdf"
    if not safe_name.lower().endswith(".pdf"):
        safe_name += ".pdf"

    # Re-encode bytes to clean base64 for Resend attachment payload.
    attachment_b64 = base64.b64encode(pdf_bytes).decode("ascii")

    resend.api_key = api_key
    params = {
        "from": f"{from_name} <{sender_email}>",
        "to": [str(payload.to)],
        "subject": payload.subject or "Invoice",
        "text": payload.body or "Please find the invoice attached.",
        "attachments": [
            {
                "filename": safe_name,
                "content": attachment_b64,
            }
        ],
    }

    try:
        # Resend SDK is synchronous — run in a thread so we don't block the
        # FastAPI event loop.
        result = await asyncio.to_thread(resend.Emails.send, params)
    except Exception as e:
        logging.error(f"Resend send failed: {e}")
        raise HTTPException(status_code=500, detail=f"Could not send email: {e}")

    email_id = result.get("id") if isinstance(result, dict) else None
    logging.info(
        f"Email: invoice sent to {payload.to} ({safe_name}, {len(pdf_bytes)} bytes, id={email_id})"
    )
    return {
        "ok": True,
        "to": str(payload.to),
        "filename": safe_name,
        "size": len(pdf_bytes),
        "id": email_id,
    }


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

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
