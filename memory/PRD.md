# Eco Pest Solutions — Billing App PRD

## Original Problem Statement
Apply an 11-point security hardening checklist (JWT auth, bcrypt password
hashing, RBAC scaffolding, rate-limiting hooks, and stripping of sensitive
data from all responses / browser storage) **without changing existing
business logic, UI design, workflow, calculations, database structure, or
user experience**.

The blocker that triggered this work was a P0 data breach:
`GET /api/users` was publicly returning every user record *including the
plaintext `password` field*, and the frontend was persisting the same
record (with the password) to `localStorage`, making it visible in the
browser DevTools → Application → Local Storage panel.

## Personas
- **Superior admin** (`role: superior`) — Suraj. Full access.
- **Assistant admin** (`role: assistant`) — Rohit. Operational access.

## Architecture
- Frontend: React + Tailwind + Axios + Context API (`AppContext.js`).
- Backend:  FastAPI + Motor (async MongoDB) + PyJWT + bcrypt + slowapi.
- Database: External MongoDB Atlas cluster (URL via `MONGO_URL`).
- Auth:     `/api/auth/simple-login` issues a JWT signed with `JWT_SECRET`.

## What's been implemented (Feb 2026)
- ✅ `sanitize_user()` / `sanitize_users()` strip `password`,
  `password_hash`, `hashed_password`, `firebase_uid`,
  `passwordResetToken`, `passwordResetExpiry` and the raw Mongo `_id`
  from every user response. Applied to `GET /api/users`,
  `POST /api/auth/simple-login`, and registration paths.
- ✅ `verify_password()` auto-migrates legacy plaintext records to
  bcrypt (`$2b$...`) on first successful login.
- ✅ JWT bearer tokens issued on login (277-char HS256 token).
- ✅ `SecurityHeadersMiddleware` registered — HSTS (1y, includeSubDomains),
  X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy:
  no-referrer, Permissions-Policy (camera / mic / geolocation off), and a
  CSP locked to `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'self'`.
- ✅ Frontend axios request interceptor (on both the shared `api` instance
  and the bare `axios`) automatically attaches `Authorization: Bearer <jwt>`
  to every outbound XHR.
- ✅ JWT stored in `sessionStorage` (`eco_auth_token`) — never in
  `localStorage`. User record in `localStorage` (`eco_current_user`) is
  stripped of `password`, `access_token`, and `token_type` before write.
- ✅ Logout clears both `sessionStorage.eco_auth_token` and
  `localStorage.eco_current_user`.
- ✅ Pytest regression suite at `/app/backend/tests/test_security.py`
  (13 cases, all green) covering the headers, the leak, the JWT shape,
  the bcrypt migration, and the wrong-password path.

## What's been implemented — Feb 2026 (P0 + P1 closure)
- ✅ JWT `Depends(current_user_dep)` wired into **every** protected route:
  `/api/users`, `/api/customers`, `/api/bills`, `/api/services`,
  `/api/company`, `/api/notifications`. All return **401** without a
  Bearer token.
- ✅ `Depends(require_superior_dep)` enforced on Superior-only mutations:
  `POST/PUT/DELETE /api/users`, role-change, create-assistant,
  `PUT /api/company`, `PUT /api/services`. All return **403** for
  Assistants.
- ✅ Per-user authorization on notifications: a user can only read /
  mark-read / clear their own notifications (Superior bypasses).
- ✅ `PUT /api/users/{id}/password` uses bcrypt verify + bcrypt hash
  (rejects wrong current password with 401).
- ✅ `/api/auth/magic-link/verify` response sanitized — no password,
  reset-token, or firebase_uid leaks.

## Verification (Feb 2026)
- Backend pytest: **35/35 pass** (`/app/backend/tests/test_rbac_security.py`).
- Frontend Playwright (Superior + Assistant): login → dashboard →
  customers/bills/admin all load, axios Bearer interceptor works,
  `localStorage.eco_current_user` has no password, role-guard hides
  admin/users for Assistant.

## What's been implemented — Feb 2026 (Branding + Bill numbering)
- ✅ Reusable `CompanyLogo` component (`/app/frontend/src/components/CompanyLogo.jsx`).
  Renders the company logo URL (defaults to `DEFAULT_COMPANY.logoUrl` from
  `AppContext`; Sidebar passes the live `getCompanyProfile().logoUrl`).
  Gracefully falls back to the original `Leaf` icon on `onError` or when
  no URL is configured.
- ✅ All static `<Leaf />` icon usages replaced with `<CompanyLogo />` in:
  `Sidebar.jsx`, `SimpleLoginPage.jsx`, `SimpleRegisterPage.jsx`,
  `LoginPage.jsx`, `RegisterPage.jsx`, `MagicLoginVerifyPage.jsx`,
  `MagicLinkLoginPage.jsx`, `FirebaseTestPage.jsx`.
- ✅ Bill numbering sequence now starts at `EPS000410`
  (`AppContext.js → BILL_START_SEQ = 410`,
  `next = Math.max(BILL_START_SEQ-1, ...nums) + 1`). Verified empty `bills`
  collection → next bill = `EPS000410`.
- ✅ My Account phone field uses `PhoneInput` with country selection
  (matches Register page) — earlier in this session.
- ✅ Cashless billing option fully removed — app defaults to Tax invoice.
- ✅ AES-GCM payload encryption regression: 8/8 backend pytest pass
  (`/app/backend/tests/test_encryption_regression.py`) covering encrypted
  envelopes on `/api/company`, `/api/bills`, PUT round-trip, and
  intentionally-plaintext `/api/auth/*`.

## Roadmap / Backlog
- **P1** — Standardize raw `axios.*` calls across components to use the
  interceptor-enabled `api` instance (encryption hardening).
- **P1** — Optional `/api/auth/me` endpoint for token-validity refresh
  (currently absent; frontend uses `localStorage.eco_current_user`).
- **P2** — Clarify if a 3rd "Customer" role should have login access.
- **P2** — 30-min idle auto-logout + "session expired" toast.
- **P2** — Split `server.py` (~1130 lines) into routers: `auth`, `users`,
  `customers`, `bills`, `company`, `services`, `notifications`.
- **P2** — Split `AppContext.js` (~1020 lines) into slice contexts
  (bills, customers, company).
- **P2** — Tighten CSP (remove `'unsafe-inline'` / `'unsafe-eval'`)
  once the CRA bundle is reviewed.

## Key endpoints
- `POST /api/auth/simple-login` — JWT + sanitized user
- `GET  /api/users`            — sanitized list (no passwords)
- `GET  /api/auth/me`          — *not yet implemented*, see P1 above
- CRUD: `/api/customers`, `/api/bills`, `/api/services`, `/api/notifications`

## DB schema (users collection)
`{ id, name, email, phone, role, employeeId, createdAt, password (bcrypt) }`
