# Deployment / IT prerequisites

> What IT or an ops engineer needs to provision before this portal can run in
> production. For local development setup, see the root [README.md](../README.md)
> instead — this file is about production.

## Runtime

| Component | Requirement |
|-----------|-------------|
| Node.js | ≥ 20.9 (Next.js 16's own minimum) |
| Process | `npm run build` then `npm run start` |
| HTTPS | Required — the public URL must exactly match `AUTH_URL` (NextAuth cookies are scoped to it) |

## Database

| Component | Requirement |
|-----------|-------------|
| Engine | PostgreSQL 16+ |
| Setup | Dedicated database (e.g. `rh_annexe`); `DATABASE_URL` with `?sslmode=require` in production |
| Schema | `npm run db:push` (no migration files are used — see `doc/TECHNICAL.md` §4) |
| Seed | `npm run db:seed` creates the initial admin account |

## SMTP (password reset emails)

| Env var | Notes |
|---------|-------|
| `SMTP_HOST` | |
| `SMTP_PORT` | Default `587` |
| `SMTP_SECURE` | `true` for port 465 |
| `SMTP_USER` | |
| `SMTP_PASS` | Gmail: use an App Password, not the account password |
| `MAIL_FROM` | Defaults to `SMTP_USER` if unset |

Without SMTP configured, the app falls back to Ethereal (fake inbox) in
development only — production requires real SMTP.

## Google Drive integration — no service account needed

**This is important and differs from earlier plans for this project**: the portal
does **not** call the Google Drive API and holds no Google credentials at all. A
Google Apps Script, running under the company's own Workspace authorization, pushes
data to the portal over an authenticated webhook instead. IT does not need to
provision a GCP project, a service account, a private key, or domain-wide delegation.

What IT/the Drive administrator needs to do instead is documented in full in
[APPS_SCRIPT_SYNC_SETUP.md](./APPS_SCRIPT_SYNC_SETUP.md) — in short: deploy
`scripts/apps-script/sync.gs` as an Apps Script project under a Workspace account with
read access to the HR Drive folder, and set a shared secret
(`DRIVE_SYNC_WEBHOOK_SECRET`) that must match on both sides.

## Environment variables to inject

```env
# App
AUTH_URL=https://<production-domain>
AUTH_SECRET=<32+ random characters>
DATABASE_URL=postgresql://user:pass@host:port/rh_annexe?sslmode=require

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=

# Drive sync (Apps Script push — see APPS_SCRIPT_SYNC_SETUP.md)
DRIVE_SYNC_WEBHOOK_SECRET=<long random value, unique per environment>
APPS_SCRIPT_EXPORT_URL=<Apps Script Web App /exec URL, for the ZIP export bridge>
```

See `.env.example` at the repo root for the full list including optional/dev-only
variables.

## Outbound network access required from the app's host

- The configured PostgreSQL host
- The configured SMTP host
- **Not required**: `googleapis.com` or any other Google API host — the portal never
  calls Google directly (see above)

## Secrets handling

- Never send secrets in plaintext email/chat — use a vault or encrypted channel.
- `DRIVE_SYNC_WEBHOOK_SECRET` must be a distinct value per environment (dev/staging/
  prod) — never reused.
- Rotate `AUTH_SECRET` and `DRIVE_SYNC_WEBHOOK_SECRET` periodically per your org's
  policy.
