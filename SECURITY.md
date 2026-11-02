# Security — Portail RH

## Secrets (`.env` — never commit)

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | JWT signing — **32+ random chars** in production |
| `ENCRYPTION_KEY` | Optional separate key for encrypting admin-visible passwords at rest |
| `DATABASE_URL` | PostgreSQL connection (Neon: use pooled URL + SSL) |
| `SMTP_*` | Email credentials — use app passwords, not account passwords |
| `DRIVE_SYNC_WEBHOOK_SECRET` | Shared HMAC secret between the portal and the Google Apps Script — never reuse between environments |
| `APPS_SCRIPT_EXPORT_URL` | Apps Script Web App URL for the ZIP export bridge — treat as sensitive (it's an unauthenticated-by-Google-but-HMAC-checked endpoint) |

Generate secrets:

```bash
openssl rand -base64 32
```

## What the app enforces

### Authentication
- Bcrypt password hashing (cost 12)
- JWT sessions, **8 hour** expiry
- `httpOnly` + `secure` cookies in production
- Failed login **timing delay** (reduces enumeration)
- Route protection via middleware (`/dashboard`, `/admin`, `/settings`)

### API
- All admin/settings routes require authenticated session
- `/admin/*` APIs require `ADMIN` role
- **Rate limiting** on login-adjacent flows (per IP, in-memory)
- **Origin check** on mutations in production
- JSON body size cap (16 KB)
- Generic error messages (no stack traces to clients)

### Password reset
- Only **registered active** users receive reset emails
- Reset tokens stored as **SHA-256 hashes** (not plaintext in DB)
- Previous unused tokens invalidated on new request
- 1 hour token expiry, single use

### Admin-visible passwords
- Stored **encrypted** (AES-256-GCM) in `adminVisiblePassword`
- Cleared when user changes their own password
- Never expose password hash in API responses

### HTTP headers
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`
- Content-Security-Policy (baseline)
- `X-Powered-By` disabled

### Google Drive sync (no Drive API / service account on the portal)
IT ruled out the portal ever holding Drive API credentials or a service account. Instead:
- A **Google Apps Script** runs under the company's own Workspace identity, using only native `DriveApp`/`SpreadsheetApp` services, and **pushes** the employee/document index to the portal.
- **Inbound webhook** (`POST /api/sync/apps-script`): HMAC-SHA256 signature over `{timestamp}.{body}` using `DRIVE_SYNC_WEBHOOK_SECRET`, verified with `crypto.timingSafeEqual`; timestamp must be within 5 minutes (anti-replay); strict Zod schema; rate limited.
- **Outbound ZIP export bridge** (`GET /api/search/documents/export-zip`): the one call the portal makes *to* Google — it POSTs a signed envelope to an Apps Script Web App (`doPost`), because Apps Script cannot read custom HTTP headers, so the signature/timestamp travel inside the JSON body instead. Apps Script re-derives the HMAC and does its own constant-time comparison (hand-written, since GAS has no native `timingSafeEqual`). Full details: `doc/APPS_SCRIPT_SYNC_SETUP.md`.
- Both endpoints are session-independent (no user is logged in during a background sync run), so the HMAC scheme — not `requireSession()` — is the actual access control for the webhook; the ZIP bridge additionally requires a logged-in session on the portal side before it will call out to Google.

## Production checklist (Neon / Vercel)

- [ ] Strong `AUTH_SECRET` (32+ chars)
- [ ] `AUTH_URL` = exact production URL (`https://...`)
- [ ] Neon DB with SSL (`?sslmode=require`)
- [ ] HTTPS only
- [ ] Rotate Gmail app password / use corporate SMTP
- [ ] Restrict admin account creation
- [ ] Regular dependency updates (`npm audit`)
- [ ] Do not log SMTP passwords or reset links

## Known limitations

| Item | Note |
|------|------|
| Rate limiting | In-memory — resets on deploy; use Redis for multi-instance |
| Admin sees some passwords | By RH requirement — encrypted at rest, not visible after user change |
| Credentials auth | No MFA yet — consider adding for production |
| No audit log | Document access and permission changes are not logged — flagged as a Phase 4 gap |
| No login lockout | Only a random timing delay on failed login; no counter/lockout after repeated failures |
| No automated dependency scanning | `npm audit` is manual; no Dependabot/CI scan wired up yet |
| Broad CSP | Content-Security-Policy is a working baseline, not yet tightened per-directive for production |

## Report issues

Contact your IT / project supervisor before deploying with real employee data.
