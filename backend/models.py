from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any
from datetime import datetime


# ---------------------------------------------------------------------------
# NOTE: We use `extra="allow"` on persisted models so dynamic fields added by
# the frontend (verification metadata, approval audit fields, custom flags,
# etc.) round-trip through the API without being silently dropped.
# ---------------------------------------------------------------------------


# User Models
# SECURITY: `password` is intentionally OMITTED from the public User response
# model so password hashes/plaintext can never leak through any
# `response_model=User` route. The write-side `UserCreate` still accepts a
# password (which the server hashes before storing).
class User(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    name: str
    email: str
    phone: Optional[str] = ""
    role: str  # 'superior' or 'assistant'
    employeeId: Optional[str] = ""
    createdAt: str


class UserCreate(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str
    email: str
    phone: Optional[str] = ""
    password: Optional[str] = ""
    role: str
    employeeId: Optional[str] = ""


# Customer Models
class Customer(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    gstNumber: Optional[str] = ""
    createdAt: str
    createdBy: Optional[str] = ""


class CustomerCreate(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    gstNumber: Optional[str] = ""
    createdBy: Optional[str] = ""


# Bill Models — accept arbitrary extra fields (rows, verification metadata,
# approval state, audit fields, etc.) and pass them through transparently.
class Bill(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    billNumber: str
    type: Optional[str] = "tax"
    date: Optional[str] = ""
    customerName: Optional[str] = ""
    rows: List[Any] = []
    grandTotal: Optional[float] = 0
    total: Optional[float] = 0
    status: Optional[str] = "pending"
    createdBy: Optional[str] = ""
    createdAt: str


class BillCreate(BaseModel):
    model_config = ConfigDict(extra="allow")

    billNumber: str
    type: Optional[str] = "tax"
    date: Optional[str] = ""
    customerName: Optional[str] = ""
    rows: List[Any] = []
    grandTotal: Optional[float] = 0
    total: Optional[float] = 0
    status: Optional[str] = "pending"
    createdBy: Optional[str] = ""


# Company Profile Models
class CompanyProfile(BaseModel):
    model_config = ConfigDict(extra="allow")

    # Default ensures GET/PUT always succeed even if the persisted doc is partial
    # (e.g. a PUT that only patches `address`). Pydantic validation no longer 500s.
    name: Optional[str] = "ECO PEST SOLUTIONS"
    gstNumber: Optional[str] = ""
    sacCode: Optional[str] = ""
    phone: Any = ""
    email: Optional[str] = ""
    website: Optional[str] = ""
    address: Optional[str] = ""
    bankHolder: Optional[str] = ""
    bankName: Optional[str] = ""
    bankAccount: Optional[str] = ""
    ifscCode: Optional[str] = ""
    micrCode: Optional[str] = ""
    cgst: Optional[float] = 9
    sgst: Optional[float] = 9
    logo: Optional[str] = ""


class CompanyProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: Optional[str] = None
    gstNumber: Optional[str] = None
    sacCode: Optional[str] = None
    phone: Optional[Any] = None
    email: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    bankHolder: Optional[str] = None
    bankName: Optional[str] = None
    bankAccount: Optional[str] = None
    ifscCode: Optional[str] = None
    micrCode: Optional[str] = None
    cgst: Optional[float] = None
    sgst: Optional[float] = None
    logo: Optional[str] = None


# Notification Models
class Notification(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    userId: str
    type: str
    message: str
    billNumber: Optional[str] = ""
    read: bool = False
    createdAt: str


class NotificationCreate(BaseModel):
    model_config = ConfigDict(extra="allow")

    userId: Any  # accept int or str; server coerces to str on write
    type: str
    message: str
    billNumber: Optional[str] = ""
