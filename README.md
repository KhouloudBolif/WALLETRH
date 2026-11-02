# Portail RH Documents — Amendis / Veolia

Web portal for HR document access management. Employees' files stay on **Google
Drive**; a Google Apps Script pushes an index of that Drive tree into the portal's
PostgreSQL database, which powers search, permissions, and document access — the
portal itself never calls the Drive API or holds any Google credentials.

## Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js ≥ 20.9** | Next.js 16's own minimum. Use the version in [`.nvmrc`](./.nvmrc) if you use `nvm`. |
| **PostgreSQL 16+** | Running locally or reachable via connection string. On Windows with PostgreSQL 18, the local instance often runs on port **5433**, not the default 5432 — check before assuming the default. |
| **npm** | The only package manager used in this repo (`package-lock.json` is committed). |

## Quick start

```bash
git clone <repo-url>
cd projet-rh-annexe
npm install

cp .env.example .env
# Edit .env: at minimum set DATABASE_URL and AUTH_SECRET (openssl rand -base64 32).
# SMTP/Drive-sync vars can stay empty for local dev — see comments in .env.example.

npm run db:setup   # prisma db push + seed the initial admin account
npm run dev
```

Open **http://localhost:3000** — login with the seeded admin account:
`admin@amendis.ma` / `Admin123!`

For everything IT needs to provision a **production** deployment (hosting, SSL,
outbound network, env vars to inject), see [doc/DEPLOYMENT.md](./doc/DEPLOYMENT.md).

## npm scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run dev:clean` | Delete `.next` then start dev — fixes stale-cache weirdness (see `doc/TECHNICAL.md` §17) |
| `npm run build` | Production build |
| `npm run start` | Run a production build (after `build`) |
| `npm run lint` | ESLint |
| `npm run db:push` | Sync the Prisma schema to the database (no migration files are used in this project) |
| `npm run db:seed` | Seed the initial admin account only |
| `npm run db:setup` | `db:push` + `db:seed` — the one command to bootstrap a fresh database |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | `prisma migrate dev` — not the primary flow here, see note below |
| `npm run db:studio` | Open Prisma Studio |
| `npm run sync:exercise` | Index the local `doc/debut` sample data into Postgres — dev/test tool only, not how production sync works |
| `npm run validate:sync` | Diff the DB index against the local exercise filesystem (expects 0 diff) |
| `npm run test:exercise` | Logic tests — data parsing, permission defaults, search (no test framework required) |
| `npm run mock:exercise` | Regenerate `lib/mock/*` fixtures from `doc/debut` (used only by `test:exercise`) |
| `npm test` | `lint` + `test:exercise` + `build`, in order |

**Note on `db:migrate`**: this project bootstraps its schema with `prisma db push`,
not migration files — there is no `prisma/migrations/` directory. `db:migrate` exists
as a script but isn't the setup path; use `db:setup` / `db:push` instead unless you're
deliberately introducing a migrations workflow.

## Project structure

```
app/
  (auth)/          Public: login, forgot/reset password — out of scope for the portal redesign
  (protected)/     Everything behind a session: dashboard, admin, settings
  api/              Route handlers (session-authenticated + the HMAC-signed sync webhook)
components/         UI, grouped by area (admin/, dashboard/, layout/, ui/, ...)
lib/                Server logic: auth, permissions, search, sync, security, validations
prisma/             schema.prisma, seed.ts (no migrations/ — see npm scripts note above)
scripts/            CLI dev tools + the reference Apps Script (scripts/apps-script/sync.gs)
doc/                Architecture reference, deployment guide, Apps Script setup, domain reference data
```

See [doc/TECHNICAL.md](./doc/TECHNICAL.md) §5 for the full annotated repository tree.

## Current features

- Authentication (login, forgot/reset password), admin user management, account settings
- Real Google Drive sync: a Google Apps Script (native `DriveApp`/`SpreadsheetApp` services, no Drive API/service account on the portal) pushes the employee/document index to the portal over a signed webhook
- Document search with advanced filters (identity, org, dates, derived fields), full-text search across all Base sheet columns
- Excel export and ZIP export (folder-structured, per-employee) of search results
- Employee directory, dossier pages, and per-employee document completeness checks
- Folder-level permissions matrix (role + per-user overrides)
- Read-only sync status/history page for admins
- Security hardening (encryption, rate limits, secure headers, HMAC-signed sync/export endpoints)

## Tech stack

Next.js 16 · React 19 · TypeScript · PostgreSQL · Prisma 7 · NextAuth v5 · Tailwind v4 · Shadcn/ui · Google Apps Script

## Where to go next

| Document | Read this for |
|---|---|
| **[doc/TECHNICAL.md](./doc/TECHNICAL.md)** | The living architecture reference — auth, data model, API routes, permissions, conventions. Read this before implementing anything. |
| **[doc/DEPLOYMENT.md](./doc/DEPLOYMENT.md)** | What IT needs to provision for production |
| **[doc/APPS_SCRIPT_SYNC_SETUP.md](./doc/APPS_SCRIPT_SYNC_SETUP.md)** | Deploying and configuring the Google Apps Script that feeds this app its data |
| **[doc/VISUAL_IDENTITY.md](./doc/VISUAL_IDENTITY.md)** | Brand colors, typography, UI patterns |
| **[doc/FEATURE_IDEAS.md](./doc/FEATURE_IDEAS.md)** | Backlog / deferred refinements |
| **[SECURITY.md](./SECURITY.md)** | Security measures & production checklist |

## License

Internal use — Amendis / Veolia RH project.
