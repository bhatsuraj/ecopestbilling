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

## Verification (Feb 2026)
- Backend pytest: 13/13 pass.
- Frontend Playwright smoke: login → dashboard → XHR bears JWT →
  logout clears both stores. No `password` substring in any response or
  in any browser storage.

## Roadmap / Backlog
- **P1** — Wire `build_get_current_user(users_collection)` into mutation
  endpoints (`/api/customers`, `/api/bills`, `/api/users` PUT/DELETE,
  `/api/notifications`, `/api/company`, `/api/services`) via FastAPI
  `Depends`. The JWT is currently issued, attached, and accepted, but the
  backend does not yet enforce it on writes. Flagged by the testing agent
  as the remaining open security gap.
- **P1** — Pick one canonical `get_current_user`. There are currently two
  in the codebase (Firebase-based in `server.py:335` and JWT-based via
  `security.build_get_current_user`). Future devs will pick the wrong one.
- **P2** — Implement strict RBAC: assistants should not be able to
  read/modify records that belong to other users.
- **P2** — Tighten CSP (remove `'unsafe-inline'` / `'unsafe-eval'`) once
  the CRA bundle is reviewed / ejected.
- **P2** — Split `server.py` (1025 lines) into routers: `auth`, `users`,
  `customers`, `bills`, `company`, `services`, `notifications`.

## Key endpoints
- `POST /api/auth/simple-login` — JWT + sanitized user
- `GET  /api/users`            — sanitized list (no passwords)
- `GET  /api/auth/me`          — *not yet implemented*, see P1 above
- CRUD: `/api/customers`, `/api/bills`, `/api/services`, `/api/notifications`

## DB schema (users collection)
`{ id, name, email, phone, role, employeeId, createdAt, password (bcrypt) }`
