# TECHNICAL.md — Portail RH Documents

> **Living document for developers and Cursor AI.**  
> Update this file whenever architecture, features, or conventions change.  
> **Last updated:** 2026-07-19 — Documentation overhaul for project handoff (see changelog).

---

## How to use this file (Cursor / contributors)

1. **Read this file first** before implementing features or refactors.
2. **Update this file** in the same PR/commit when you change:
   - Routes, APIs, Prisma models, env vars, security behaviour, or phase status
3. Prefer patterns already established here over introducing new stacks.
4. **Do not** commit `.env`, expose secrets in logs, or bypass `requireAdmin` / middleware.
5. User-facing copy is **French**; code and technical docs are **English**.

---

## 1. Project identity

| Field | Value |
|-------|--------|
| **Name** | `projet-rh-annexe` |
| **Client** | Amendis / Veolia — HR department |
| **Purpose** | Web portal to search employee documents on Google Drive with per-user, per-document-type access control |
| **Scope** | Side project (not the main PFE thesis) |
| **Repo layout** | Single app repo — `README.md` for setup, `doc/` for architecture/deployment/domain reference |

---

## 2. Business context

### Current state (Google Drive)

- One **root folder** → subfolders named by employee **matricule** (1000+ employees).
- Each employee folder has **7–8 standard subfolders** (e.g. diplomas, CIN, children — exact names TBD with RH).
- Files are mostly **PDF**; shareable Drive links exist today.

### Pain points

- Manual search in Drive is slow.
- Hard to grant **partial access** (e.g. only diplomas for employee X, not full dossier).

### Target solution

| Layer | Responsibility |
|-------|----------------|
| **Google Drive** | File storage (source of truth) — PDFs stay on Drive |
| **PostgreSQL** | Users, permissions, **indexed metadata** (not file binaries) |
| **Next.js app** | Auth, access control, search UX, admin |

### Critical architecture rule

**Never** rely on live Drive API search per user click for 1000+ employees.  
**Always** sync/index into PostgreSQL, then query locally.

### Drive security model (implemented)

**IT does not allow the portal to hold Drive credentials** (no OAuth client, no
service account) — the originally planned "Model B" service-account approach
was ruled out. Instead:

- A **Google Apps Script**, running under the company's own Workspace
  authorization (native `DriveApp`/`SpreadsheetApp` services only — never the
  Drive REST API), reads the Drive folder tree + Base sheet and **pushes** the
  listing to the portal over one authenticated, signed webhook
  (`POST /api/sync/apps-script`). The portal never calls Drive to sync.
- The **one exception**: the ZIP-export bridge (§9, "ZIP export"), where the
  portal calls *out* to a second Apps Script Web App endpoint to bundle actual
  file bytes — still no Drive credentials held by the portal, since Apps
  Script does the Drive touching either way.
- `webViewLink` (and, for ZIP export, actual file bytes) are only ever
  produced after a server-side `AccessRule` check. Denied docs: visible in UI
  but **greyed, no URL**.
- See `doc/APPS_SCRIPT_SYNC_SETUP.md` for the full setup, security model, and
  gotchas actually hit during real-account testing.

---

## 3. Implementation status

### Phase 1 — DONE

- [x] Next.js 16 + TypeScript + Tailwind v4 + Shadcn/ui
- [x] PostgreSQL + Prisma 7 (`@prisma/adapter-pg`)
- [x] NextAuth v5 Credentials + JWT (8h session)
- [x] Pages: `/`, `/login`, `/forgot-password`, `/reset-password`, `/dashboard`, `/dashboard/search`, `/dashboard/employees`, `/dashboard/employees/[matricule]`, `/dashboard/completeness`, `/admin`, `/admin/sync`, `/admin/permissions`, `/admin/users`, `/settings`
- [x] Admin: user CRUD, password reset, viewable password rules
- [x] Settings: profile + change password
- [x] SMTP (real email) + Ethereal fallback
- [x] Security: encryption, rate limits, hashed reset tokens, headers

### Phase 2a — DONE (local exercise sync — CLI-only dev tool)

- [x] Prisma models: `Employee`, `DriveFile`, `SyncLog` (+ `SyncStatus` enum)
- [x] `lib/storage/localFolderProvider.ts` — scans `doc/debut/Dossiers Digitaux`
- [x] `lib/storage/codification.ts` — filename parser (`{matricule}_{label}[_Enfant_x][_date].pdf`) + folder→category mapping
- [x] `lib/import/parseExcelBase.ts` — Base sheet import via `exceljs`
- [x] `lib/sync/syncDriveIndex.ts` — walks the local provider, builds the raw listing, calls `reconcileDriveIndex()`
- [x] `npm run sync:exercise` / `npm run validate:sync` (110 files, 0 diff)
- **Not in the admin UI anymore** (see Phase 2b below — the "Synchroniser" button and its scheduler were removed 2026-07-17 after real Apps Script data arrived, since both paths share the same tables with global stale-removal and clicking it overwrote real synced data with the local fixture)

### Phase 2b — DONE (Google Apps Script Drive sync — the real path)

- [x] `POST /api/sync/apps-script` — HMAC-signed, replay-protected, rate-limited, strict-schema webhook that Apps Script pushes to
- [x] `lib/sync/syncDriveIndex.ts` → `reconcileDriveIndex()` — the shared, provider-agnostic core (upsert employees + files, stale-removal on `isFinal`, write `SyncLog`) used by both the local CLI path and this webhook
- [x] `lib/security/webhook-signature.ts` — HMAC-SHA256 verify (inbound) + `signWebhookPayload()` (outbound, used by the ZIP bridge)
- [x] `lib/validations/drive-sync.ts` — strict payload schema
- [x] `scripts/apps-script/sync.gs` — reference script: chunked pushes, retries with backoff, overlap-guarded via `LockService`, UTF-8-safe signing, plus the ZIP-export `doPost` bridge
- [x] Verified end-to-end against a real personal Google account, including the real exercise dataset (10 employees, 110 files, all 7 categories)
- [x] `/admin/sync` — read-only status/history view (`SyncLog` list); **no trigger button** — a real sync can only start from Apps Script itself (manual run or its own time-driven trigger)
- See `doc/APPS_SCRIPT_SYNC_SETUP.md` for setup steps, security model, and real gotchas hit during testing

### Phase 3 — DONE

- [x] `lib/search/documents.ts` — PostgreSQL search (`DriveFile` JOIN `Employee`), full filter set (identity, org, dates, document)
- [x] `GET /api/search/documents` — session + AccessRule enforced server-side
- [x] `GET /api/documents/[id]/view` — streams local PDF, or redirects to Drive `webViewLink`, after access check
- [x] `/dashboard`, `/dashboard/search`, `/dashboard/employees`, `/dashboard/employees/[matricule]` query the DB (no `lib/mock` in app code)
- Denied documents: metadata only, **no URL**
- [x] **Advanced search:** categorized multi-filter search (identité/état civil, poste & organisation, ancienneté & dates, document) covering ~15 typed `Employee` columns + `GET /api/search/filter-options` for dropdown values
- [x] **Excel export:** `GET /api/search/documents/export` streams a full-detail `.xlsx` (one row per document, employee metadata + Drive link), access-filtered server-side
- [x] **ZIP export (2026-07-18):** `GET /api/search/documents/export-zip` re-runs the search server-side, resolves each result's real Drive file ID from `webViewLink`, and calls an Apps Script Web App bridge that fetches the blobs and zips them (`Utilities.zip()`) with a `{matricule} - {nom}/{catégorie}/{fichier}` folder structure — capped at `ZIP_EXPORT_ROW_LIMIT` (150). This is the **one place the portal calls out to Google**; see §9 and `doc/APPS_SCRIPT_SYNC_SETUP.md`.
- [x] **Dossier completeness (2026-07-07):** `/dashboard/completeness` — per-employee, per-category checklist of expected document types vs what's actually indexed (`lib/document-types.ts`, `getDossierCompleteness()`); the computed gap itself is still purely derived (no stored "resolved" flag — it disappears on its own once the right file is synced in), but a user can additionally record a manual **attestation** (`CompletenessAttestation` model, `POST`/`DELETE /api/completeness/verify`) noting "I've personally checked this is fine" for a gap that can't be closed by a file upload — an independent audit annotation layered on top of the derived status, not a substitute for it
- [x] **Reporting dashboard:** `/dashboard/reporting` (`components/dashboard/reporting/*`, `lib/reporting/stats.ts`) — workforce demographics (gender split, age/seniority/children distribution, headcount by direction/service; not permission-gated, aggregate `Employee` stats only) and a completeness overview (reuses `getDossierCompleteness()`, permission-gated) rendered with `recharts`

### Phase 4 — PARTIAL

- [x] `AccessRule` CRUD API + permissions matrix (persisted, linked to `User.id`)
- [x] Default rules on user create (`ensureDefaultRolePermissions` by role)
- [x] Search/dossier/view enforce `getResolvedAccessForUser()` server-side
- [x] **Per-user employee scope** (`EmployeeScope` model — `allowedDirections`/`allowedServices` string arrays, `getEmployeeScopeForUser()`/`setEmployeeScopeForUser()`) — layered *beneath* the category/document-type checks: a denied category still wins even for an in-scope employee; empty arrays mean unrestricted; ADMIN is never scoped
- [ ] Drive-level sharing ↔ portal `AccessRule` alignment — deliberately **not** auto-synced (see §2 "Drive security model" and the open question in §19); Drive-side sharing must be maintained independently by whoever administers Drive

### Portal redesign (2026-07-18)

Full visual redesign of every authenticated page (landing and login **out of
scope**, unchanged) on branch `redesign/portal-v2` (merged to `main`):

- New serif display font (**Newsreader**, `--font-serif`) paired with the
  existing Plus Jakarta Sans for body/UI — used for page titles, employee
  names, section headers
- New elevation system: layered warm-tinted shadows (`--shadow-xs/sm/md/lg`,
  `.shadow-elevation-*` utilities) replacing flat `border`-only panels
- New semantic status tokens (`--status-good/watch/critical` + `-soft`
  variants) — distinct hue family from `--brand-accent`, which stays reserved
  for actions/identity, not state
- `Panel` gained an `elevated` prop; `StatChip` gained a `StatTile` sibling
  (bigger, serif numbers) for hero/dashboard use
- Dashboard hub, employee dossier (metadata grouped into themed sections
  instead of one flat alphabetical dump), employees directory, search, admin
  pages, settings — all re-themed with the new tokens plus subtle CSS-only
  entrance/hover motion (`.enter-fade`, `.lift-on-hover`)
- `DemoBanner` removed (stale "Exercice RH — Drive en Phase 2" copy no longer
  accurate now that Phase 2b is done)
- See `doc/VISUAL_IDENTITY.md` for the full token/pattern reference

---

## 4. Tech stack (pinned)

| Package | Version / notes |
|---------|-----------------|
| next | 16.2.6, App Router, Turbopack dev |
| react | 19 |
| typescript | 5 |
| tailwindcss | 4 |
| next-auth | 5.0.0-beta.31 |
| prisma | 7.8.0, config in `prisma.config.ts` |
| @prisma/adapter-pg | PostgreSQL runtime adapter |
| bcryptjs | cost 12 |
| zod | 4 |
| react-hook-form | + @hookform/resolvers |
| framer-motion | auth animations |
| sonner | toasts |
| nodemailer | SMTP |
| shadcn | v4 / Base UI primitives |

### Database

- **PostgreSQL only** (local pgAdmin port often **5433** for PG18; Docker compose uses **5432**).
- Local DB name: `rh_annexe`.
- Production target: **Neon** (`?sslmode=require`).

---

## 5. Repository structure (detailed)

```
projet-rh-annexe/
├── app/
│   ├── (auth)/                    # Public auth layouts — out of scope for the redesign
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (protected)/               # Requires session (layout + middleware)
│   │   ├── layout.tsx             # ProtectedHeader + PortalNav (DemoBanner removed)
│   │   ├── dashboard/page.tsx     # DashboardHub — role-aware home
│   │   ├── dashboard/search/      # DocumentSearch — advanced filters + Excel/ZIP export
│   │   ├── dashboard/employees/   # Employee directory + dossier
│   │   ├── dashboard/completeness/ # Per-employee document completeness checklist
│   │   ├── dashboard/reporting/    # Workforce demographics + completeness overview charts
│   │   ├── admin/page.tsx         # Admin overview (real stats + quick links)
│   │   ├── admin/sync/page.tsx    # Read-only SyncLog status/history — no trigger button
│   │   ├── admin/permissions/     # Permissions matrix (real DB users + AccessRule)
│   │   ├── admin/users/page.tsx   # UserManagement + SmtpTestCard
│   │   └── settings/page.tsx      # AccountSettings
│   ├── api/
│   │   ├── auth/[...nextauth]/    # runtime: nodejs
│   │   ├── auth/forgot-password/
│   │   ├── auth/reset-password/
│   │   ├── admin/users/           # GET, POST
│   │   ├── admin/users/[id]/      # PATCH, PUT (reset pwd)
│   │   ├── admin/mail/test/
│   │   ├── admin/permissions/     # GET, PATCH
│   │   ├── admin/sync/            # GET only — SyncLog overview (POST trigger removed)
│   │   ├── completeness/verify/   # POST/DELETE — manual attestation on a completeness gap
│   │   ├── sync/apps-script/      # POST — Apps Script pushes here (HMAC-signed webhook)
│   │   ├── documents/[id]/view/   # Streams local PDF or redirects to Drive
│   │   ├── search/documents/      # GET — live search
│   │   ├── search/documents/export/      # GET — Excel export
│   │   ├── search/documents/export-zip/  # GET — ZIP export bridge (calls Apps Script)
│   │   ├── search/filter-options/
│   │   ├── settings/profile/
│   │   └── settings/password/
│   ├── layout.tsx                 # Root + Providers (SessionProvider, Toaster); fonts: Plus Jakarta Sans, JetBrains Mono, Newsreader
│   ├── page.tsx                   # Landing → redirect if logged in
│   └── globals.css                # Brand tokens + elevation/status tokens + Newsreader hookup
├── components/
│   ├── admin/user-management.tsx
│   ├── admin/smtp-test-card.tsx
│   ├── admin/sync-status-card.tsx       # Read-only SyncLog history view
│   ├── admin/permissions-matrix.tsx     # real portal users + AccessRule toggles
│   ├── admin/admin-overview-stats.tsx
│   ├── dashboard/dashboard-hub.tsx       # Role-aware home, StatTile hero
│   ├── dashboard/document-search.tsx     # Advanced search + Excel/ZIP export buttons
│   ├── dashboard/employee-directory.tsx
│   ├── dashboard/employee-dossier.tsx    # Identity card + themed metadata groups + documents table
│   ├── dashboard/dossier-completeness.tsx
│   ├── dashboard/reporting/              # ReportingDashboard, workforce/completeness sections, recharts wrappers
│   ├── dashboard/employee-avatar.tsx     # Sizes: xs/sm/md/lg/xl
│   ├── dashboard/search-filters/         # Filter groups + reducer-driven state
│   ├── auth/                      # auth-shell, login, forgot, reset forms — out of scope
│   ├── layout/protected-header.tsx
│   ├── layout/portal-nav.tsx      # Role-aware sub-navigation tabs
│   ├── layout/page-header.tsx     # Serif page titles
│   ├── layout/feature-card.tsx    # Lift-on-hover action cards
│   ├── layout/stat-chip.tsx       # StatChip (compact) + StatTile (hero)
│   ├── brand/brand-mark.tsx       # Shared logomark
│   ├── landing/home-hero.tsx      # Public landing page — out of scope
│   ├── settings/account-settings.tsx
│   └── ui/                        # shadcn (button, input, panel, table, dialog, …)
├── lib/
│   ├── db.ts                      # Prisma singleton + PrismaPg
│   ├── auth/password.ts           # setUserPassword, encrypt/decrypt visible pwd
│   ├── auth/require-admin.ts      # requireAdmin(), requireSession()
│   ├── auth/redirect.ts           # getRoleHomePath()
│   ├── admin/guards.ts            # ensureNotLastAdmin()
│   ├── api/user-serializer.ts     # serializeUserForAdmin — never expose hash
│   ├── mail/                      # sendMail, config, templates
│   ├── security/
│   │   ├── env.ts, encryption.ts, tokens.ts, rate-limit.ts, api.ts
│   │   └── webhook-signature.ts   # verifyWebhookSignature (inbound) + signWebhookPayload (outbound)
│   ├── document-category.ts       # 7 sous-dossiers enum + French labels
│   ├── permissions/
│   │   ├── defaults.ts            # Client-safe: getDefaultAccessMap, canViewCategoryFromMap, canViewDocument, canViewEmployee
│   │   ├── access-rules.ts        # Server-only: DB CRUD, matrix, getResolvedAccessForUser / unauthenticatedAccess / getRoleResolvedAccess
│   │   └── types.ts
│   ├── storage/
│   │   ├── storageProvider.ts     # Local-provider-only now; real Drive sync bypasses this entirely (see §2)
│   │   ├── localFolderProvider.ts # Scans doc/debut/Dossiers Digitaux — CLI dev tool only
│   │   └── codification.ts        # Filename parser + folder→category mapping
│   ├── import/parseExcelBase.ts   # Base sheet parser (exceljs) — CLI dev tool only
│   ├── sync/syncDriveIndex.ts     # reconcileDriveIndex() (shared core) + syncDriveIndex() (local CLI) + getSyncOverview()
│   ├── search/
│   │   ├── documents.ts           # PostgreSQL search, listEmployees, getEmployeeWithDocuments, searchDocumentsForExport, getDossierCompleteness
│   │   └── zip-export.ts          # Drive file ID extraction + ZIP manifest builder
│   ├── reporting/
│   │   └── stats.ts               # getWorkforceDemographics, getCompletenessOverview — aggregate queries for /dashboard/reporting
│   ├── validations/
│   │   ├── user.ts, password.ts, document-search.ts, drive-sync.ts, completeness.ts
│   └── mock/                      # Retired from app — kept for test:exercise only
├── scripts/
│   └── apps-script/sync.gs        # Reference Apps Script — sync push + ZIP export bridge (not part of the Next.js build)
├── prisma/schema.prisma
├── prisma/seed.ts                 # admin@amendis.ma / Admin123!
├── auth.ts                        # NextAuth + Credentials (imports prisma — Node only)
├── auth.config.ts                 # Edge-safe: callbacks, no prisma
├── middleware.ts                  # NextAuth(authConfig).auth — Edge
├── instrumentation.ts             # assertSecureEnvironment() + dns.setDefaultResultOrder("ipv4first") on boot
├── next.config.ts                 # security headers, reactCompiler
├── README.md                      # Entry point: prerequisites, quick start, scripts
├── SECURITY.md
├── doc/
│   ├── TECHNICAL.md               # THIS FILE
│   ├── VISUAL_IDENTITY.md
│   ├── FEATURE_IDEAS.md           # Backlog / deferred refinements
│   ├── DEPLOYMENT.md              # IT/production prerequisites (hosting, DB, SMTP, env vars)
│   ├── APPS_SCRIPT_SYNC_SETUP.md  # Apps Script setup, security model, ZIP bridge, real gotchas
│   └── debut/                     # RH exercise sample data + exercice/*.md docs (domain reference, cited by lib/document-types.ts)
├── .env.example
├── .nvmrc
└── docker-compose.yml             # optional Postgres
```

---

## 6. Authentication architecture

### Split config (required for Edge)

| File | Runs on | Contains |
|------|---------|----------|
| `auth.config.ts` | Edge + Node | `authorized` callback, jwt/session callbacks, pages, **no prisma** |
| `auth.ts` | Node only | Credentials provider, `authorize()` uses prisma + bcrypt |
| `middleware.ts` | Edge | `NextAuth(authConfig).auth` |

**Never import `@/lib/db` or `pg` in client components or auth.config.**

### Session

- Strategy: **JWT**
- Max age: **8 hours**
- Production cookies: `__Secure-authjs.session-token`, `httpOnly`, `secure`, `sameSite: lax`

### Login flow

1. `POST /api/auth/callback/credentials` (NextAuth)
2. `authorize`: validate email/password, `isActive`, bcrypt compare
3. Failed login: **400–600ms random delay** (anti-enumeration)
4. JWT gets `id` + `role`
5. Client redirects: `ADMIN` → `/admin`, else → `/dashboard`

### Route protection

`middleware.ts` matcher:

- `/dashboard/:path*`
- `/admin/:path*`
- `/settings`

`authorized` in auth.config:

- Unauthenticated → redirect to `/login`
- Non-admin on `/admin` → redirect to `/dashboard`

### Default seed user

```
Email:    admin@amendis.ma
Password: Admin123!
Role:     ADMIN
```

---

## 7. Roles & redirects

| Role | Enum | Home after login |
|------|------|------------------|
| Administrator | `ADMIN` | `/admin` |
| HR Manager | `RH_MANAGER` | `/dashboard` |
| HR Agent | `RH_AGENT` | `/dashboard` |

---

## 8. Password system

### Storage

| Field | Purpose |
|-------|---------|
| `password` | bcrypt hash — used for login |
| `passwordOrigin` | `ADMIN` \| `FORGOT_PASSWORD` \| `USER` |
| `adminVisiblePassword` | AES-256-GCM encrypted plaintext; only when origin ≠ USER |

Encryption: `lib/security/encryption.ts` — key from `ENCRYPTION_KEY` or `AUTH_SECRET`.

### Admin visibility rules

| Set by | Admin can view plaintext? |
|--------|---------------------------|
| Admin create / admin reset | Yes (encrypted in DB) |
| Forgot-password flow | Yes |
| User changes in `/settings` | **No** — field cleared, origin `USER` |

### Validation (`passwordSchema`)

- Min 8, max 128 chars
- At least one uppercase letter
- At least one digit

### Password reset tokens

- Raw token: 32 bytes hex → sent in email URL only
- DB stores **SHA-256 hash** of token (`lib/security/tokens.ts`)
- Expiry: **1 hour**, single use
- Previous unused tokens for same email invalidated on new request
- Only **active** users with registered email receive mail

---

## 9. API reference (detailed)

All routes under `app/api/**` use `export const runtime = "nodejs"` unless noted.

### Shared API behaviour

- `requireAdmin()` / `requireSession()` from `lib/auth/require-admin.ts`
- Mutations: `assertSafeMutation(request)` in production (Origin must match `AUTH_URL` host)
- `parseJsonBody()` — max 16 KB
- Rate limits: in-memory per IP (`lib/security/rate-limit.ts`) — see limits below

### Auth

| Method | Path | Auth | Rate limit | Notes |
|--------|------|------|------------|-------|
| * | `/api/auth/[...nextauth]` | — | — | NextAuth |
| POST | `/api/auth/forgot-password` | Public | 5/hour/IP | Generic response; dev fallback if no SMTP |
| POST | `/api/auth/reset-password` | Public | 10/hour/IP | Body: `{ token, password }` |

### Admin (ADMIN required)

| Method | Path | Rate limit | Notes |
|--------|------|------------|-------|
| GET | `/api/admin/users` | — | No password field in query |
| POST | `/api/admin/users` | 20/hour/IP | Body: createUserSchema |
| PATCH | `/api/admin/users/[id]` | — | Cannot patch self; last admin guard |
| PUT | `/api/admin/users/[id]` | 30/hour/IP | Admin password reset |
| POST | `/api/admin/mail/test` | 5/hour/IP | Body: `{ to }` |
| GET | `/api/admin/permissions` | — | Portal users + `AccessRule` per sous-dossier |
| PATCH | `/api/admin/permissions` | 60/hour/IP | Body: `{ type: "single" \| "user" \| "column", ... }` |
| GET | `/api/admin/sync` | — | Last log + history + index counts (read-only — no trigger route in the admin UI) |

### Sync webhook (server-to-server, HMAC-signed — not session auth)

| Method | Path | Auth | Rate limit | Notes |
|--------|------|------|------------|-------|
| POST | `/api/sync/apps-script` | HMAC signature + timestamp headers (`X-Signature`/`X-Timestamp`), 5 min skew window | 30/hour | Inbound: Apps Script pushes `{ syncLogId?, isFinal, employees?, files }` (`lib/validations/drive-sync.ts`), verified via `verifyWebhookSignature`, reconciled via `reconcileDriveIndex()` |
| GET | `/api/search/documents/export-zip` | Session (`requireSession`) | 6/min/IP | Outbound: the **one place the portal calls out to Google** — signs `{items}` via `signWebhookPayload`, POSTs an envelope (`{timestamp, signature, payload}`) to `APPS_SCRIPT_EXPORT_URL`'s `doPost(e)`, streams back the returned ZIP; capped at `ZIP_EXPORT_ROW_LIMIT` (150) rows |

### Documents (authenticated, AccessRule enforced)

| Method | Path | Rate limit | Notes |
|--------|------|------------|-------|
| GET | `/api/search/documents` | 120/min/IP | Full filter set validated by `lib/validations/document-search.ts` (`documentSearchQuerySchema`): `query`, `category`, `documentType`, `modifiedFrom/To`, `genre`, `minAge/maxAge`, `minChildren`/`childrenExact`, `hasSpouseDocument`, org fields (`direction`, `service`, `entite`, `sousEntite`, `zone`, `agence`, `poste`, `statut`, `college`, `admTech`, `position`, `encadrant`, `categorieRh`, `niveau`, `grade`, `managerMatricule`), `situation`, `minAnciennete/maxAnciennete`, `dateEntreeFrom/To`, `dateDepartFrom/To`; denied docs have no `viewUrl` |
| GET | `/api/search/documents/export` | 20/min/IP | Same filters as above (shared schema); streams an `.xlsx` — one row per document, full employee `metadata` columns + `Enfants (nb)` / `Conjoint au dossier` / document columns / absolute Drive-or-local link; denied documents are **excluded from the file entirely** (re-derives `viewerAccess` server-side) |
| GET | `/api/search/documents/export-zip` | 6/min/IP | Same filters; builds a per-employee/per-category-folder ZIP of the matching PDFs via the Apps Script bridge (see §9 sync webhook table above and `doc/APPS_SCRIPT_SYNC_SETUP.md`); capped at 150 rows, skipped files reported via `X-Export-Zip-Skipped` header |
| GET | `/api/search/filter-options` | 60/min/IP | Distinct non-null values per org/identity `Employee` field, for filter dropdowns |
| GET | `/api/documents/[id]/view` | — | Streams local PDF (or redirects to Drive `webViewLink`); denied → 404 |
| POST / DELETE | `/api/completeness/verify` | 30/min/IP | Body: `{ matricule, category, documentType, note? }` (`documentType: "*"` = whole-category). Records/removes a manual `CompletenessAttestation` — same per-document access check as viewing, so a user can only attest a gap they'd be allowed to see in the first place |

### Settings (authenticated)

| Method | Path | Rate limit | Notes |
|--------|------|------------|-------|
| PATCH | `/api/settings/profile` | — | name, email |
| PATCH | `/api/settings/password` | 10/hour/IP | Sets origin USER |

---

## 10. Prisma schema (current)

```prisma
model User {
  id                   String         @id @default(cuid())
  email                String         @unique
  name                 String
  password             String         // bcrypt only
  passwordOrigin       PasswordOrigin @default(USER)
  adminVisiblePassword String?        // encrypted, optional
  role                 Role           @default(RH_AGENT)
  isActive             Boolean        @default(true)
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt
  accessRules          AccessRule[]
}

enum DocumentCategory {
  RECRUTEMENT
  ETAT_CIVIL
  ARRETES
  MESURES_DISCIPLINAIRES
  MALADIES_ACCIDENTS_TRAVAIL
  DEPART
  DIVERS
}

model AccessRule {
  id        String           @id @default(cuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  category  DocumentCategory
  canView   Boolean          @default(true)
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  @@unique([userId, category])   // folder-level; per-employee scope is EmployeeScope below (direction/service, not per-record)
}

/// Per-user override scoping which employees a user can see at all, layered beneath
/// the category/document-type checks — a denied category still wins even for an
/// in-scope employee. Empty arrays = unrestricted. ADMIN is never scoped.
model EmployeeScope {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  allowedDirections String[]
  allowedServices   String[]
  updatedAt         DateTime @updatedAt
}

/// A manual "I've checked this gap and it's fine" annotation on a completeness
/// checklist item — independent of the derived present/missing computation, which
/// still auto-resolves on its own once a matching file is synced in.
model CompletenessAttestation {
  id           String           @id @default(cuid())
  employeeId   String
  employee     Employee         @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  category     DocumentCategory
  documentType String           @default("*")  // "*" = whole-category attestation
  verifiedById String
  verifiedBy   User             @relation(fields: [verifiedById], references: [id])
  verifiedAt   DateTime         @default(now())
  note         String?

  @@unique([employeeId, category, documentType])
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  email     String
  token     String   @unique  // SHA-256 hash, NOT raw token
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

### Default access by role (`lib/permissions/defaults.ts`)

| Role | Default folder access |
|------|----------------------|
| `ADMIN` | All 7 (implicit; no `AccessRule` rows stored) |
| `RH_MANAGER` | All 7 |
| `RH_AGENT` | Recrutement + État civil only |

On `POST /api/admin/users`, `ensureDefaultAccessRules()` seeds rows for non-admin users. Admin can override via `/admin/permissions`.

### Index models (Phase 2a — in schema)

> Codification catalog: `doc/debut/exercice/CODIFICATION.md`.

```prisma
model Employee {
  id            String      @id @default(cuid())
  matricule     String      @unique
  displayName   String
  genre         String?     // H / F (filter)
  cin           String?
  age           Int?        // filter
  anciennete    Int?        // years
  direction     String?     // Base sheet metadata
  service       String?
  poste         String?
  statut        String?
  situation     String?
  childrenCount Int         @default(0)  // derived from _Enfant_ filename tokens
  // Curated additional typed filter columns (2026-07-01) — rest of the 44
  // Base columns stay searchable only via metadata/searchText.
  entite            String?
  sousEntite        String?
  zone              String?
  agence            String?
  college           String?   // Collège: C/M/E/HC
  admTech           String?
  position          String?   // N / N-1 / N-2
  encadrant         Boolean?
  niveau            String?
  grade             String?
  categorieRh       String?   // Base "Catégorie" — avoids clash with DriveFile.category
  managerMatricule  String?
  dateEntree        DateTime?
  dateDepart        DateTime?
  hasSpouseDocument Boolean   @default(false) // derived from a "_Conjoint" filename token
  searchText    String      @default("") // normalized all-fields blob (full-text search)
  metadata      Json?       // all 44 Base columns, label → value
  lastSyncedAt  DateTime?
  files         DriveFile[]
}

model DriveFile {
  id              String           @id @default(cuid())
  driveFileId     String           @unique  // real Drive file ID (Apps Script sync) or sha256(source:path) for local
  name            String
  mimeType        String           @default("application/pdf")
  category        DocumentCategory
  folderName      String           // e.g. "2- Etat Civil"
  documentType    String?          // codification label without matricule
  webViewLink     String?          // never sent to client unless authorized
  localPath       String?          // local provider only — streamed via /api/documents/[id]/view
  employeeId      String           // FK → Employee (cascade delete)
  parsedMetadata  Json?            // { enfant, dateToken }
  driveModifiedAt DateTime?

  @@index([employeeId, category])
}

enum SyncStatus { RUNNING SUCCESS FAILED }

model SyncLog {
  id               String     @id @default(cuid())
  startedAt        DateTime   @default(now())
  finishedAt       DateTime?
  status           SyncStatus
  source           String     @default("local-exercise")  // "google-apps-script" for the real path
  employeesIndexed Int        @default(0)
  filesAdded       Int        @default(0)
  filesUpdated     Int        @default(0)
  filesRemoved     Int        @default(0)
  errorMessage     String?
}
```

// AccessRule.employeeId — optional per-employee scope (Phase 4, not implemented)

---

## 11. Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:port/rh_annexe?schema=public` |
| `AUTH_SECRET` | Yes | 32+ chars in production; checked in `instrumentation.ts` |
| `AUTH_URL` | Yes | `http://localhost:3000` dev; exact production URL in prod |
| `ENCRYPTION_KEY` | No | Defaults to `AUTH_SECRET` for field encryption |
| `SMTP_HOST` | For real mail | If unset → Ethereal in dev |
| `SMTP_PORT` | No | Default 587 |
| `SMTP_SECURE` | No | `true` for 465 |
| `SMTP_USER` | With SMTP_HOST | |
| `SMTP_PASS` | With SMTP_HOST | Gmail: App Password |
| `MAIL_FROM` | No | Defaults to SMTP_USER |
| `EXERCISE_DRIVE_ROOT` | No | Override local storage root (default `doc/debut/Dossiers Digitaux`) — CLI dev tool only |
| `EXERCISE_XLSX_PATH` | No | Override Base workbook path (default `doc/debut/Etat personnel exercice.xlsx`) — CLI dev tool only |
| `DRIVE_SYNC_WEBHOOK_SECRET` | Yes (for real sync) | Shared HMAC secret between the portal and the Apps Script Script Properties; generate a long random value per environment, never reuse between staging/prod |
| `APPS_SCRIPT_EXPORT_URL` | Yes (for ZIP export) | Web App `/exec` URL from deploying `doPost(e)` in `scripts/apps-script/sync.gs`; signed with the same `DRIVE_SYNC_WEBHOOK_SECRET`. See `doc/APPS_SCRIPT_SYNC_SETUP.md` |

> The Google Workspace service-account plan (`GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_DRIVE_ROOT_FOLDER_ID`/etc.) considered earlier was **abandoned** per IT's "no Drive API on the portal" ruling and never implemented — do not resurrect these vars.

---

## 12. NPM scripts

| Script | Command |
|--------|---------|
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run db:setup` | `prisma db push && tsx prisma/seed.ts` |
| `npm run db:seed` | Seed admin only |
| `npm run db:push` | Sync schema |
| `npm run db:studio` | Prisma Studio |
| `npm run sync:exercise` | Index `doc/debut` into PostgreSQL (CLI sync) |
| `npm run validate:sync` | Diff DB index vs filesystem — expects 110 files, 0 diff |
| `npm run mock:exercise` | Regenerate `lib/mock/*` from `doc/debut` (tests only) |
| `npm run test:exercise` | Logic tests (525 assertions) — data, defaults, search |

---

## 13. Security checklist (implemented)

See `SECURITY.md` for narrative. Summary for implementers:

- [x] bcrypt passwords
- [x] JWT + secure cookies (prod)
- [x] Reset tokens hashed in DB
- [x] Admin-visible passwords encrypted at rest
- [x] Rate limiting on auth/settings/admin mutations
- [x] Origin check on mutations (prod)
- [x] Security headers (CSP, HSTS, X-Frame-Options, …)
- [x] Last admin cannot be deactivated/demoted
- [x] API never returns `password` hash
- [x] Forgot password only for registered active users
- [x] Generic forgot-password response (no email enumeration)
- [x] Inbound sync webhook: HMAC-SHA256 signature + timestamp anti-replay (5 min skew), strict Zod schema, rate limit — see `doc/APPS_SCRIPT_SYNC_SETUP.md`
- [x] Outbound ZIP bridge: same HMAC scheme, envelope-wrapped in the JSON body (Apps Script `doPost` cannot read custom headers), constant-time compare on the Apps Script side
- [ ] MFA — not implemented
- [ ] Redis rate limits — not implemented (in-memory only)
- [ ] Audit log (document access, permission changes) — not implemented
- [ ] Login lockout after repeated failures — only the random delay exists, no counter/lockout
- [ ] Automated dependency scanning (Dependabot/`npm audit` in CI) — not implemented

---

## 14. UI / UX conventions

- Language: **French** for all user-visible strings
- Fonts: **Plus Jakarta Sans** (body/UI), **JetBrains Mono** (data/mono), **Newsreader** (serif display — page titles, panel headers, hero numbers via `--font-serif`/`--font-heading`)
- **Visual identity:** warm neutral + accent red — see **[doc/VISUAL_IDENTITY.md](./doc/VISUAL_IDENTITY.md)**
- Logomark: `components/brand/brand-mark.tsx` (charcoal tile + red corner + RH)
- App surfaces: `.portal-canvas` background, `Panel` (`elevated` prop for `.shadow-elevation-md` vs default `.shadow-elevation-xs`) / `StatChip` (compact) / `StatTile` (hero) for sections
- Elevation tokens: `--shadow-xs/sm/md/lg` → `.shadow-elevation-xs/sm/md/lg` utilities
- Status color tokens (distinct hue family from `--brand-accent`, which stays reserved for actions/identity): `--status-good/-soft`, `--status-watch/-soft`, `--status-critical/-soft` (light + dark variants) — use for sync-log badges, completeness banners, etc., never hardcoded `amber-*`/`emerald-*`
- Motion: `.enter-fade` (staggered via inline `animationDelay`) and `.lift-on-hover` CSS-only utilities — both respect `prefers-reduced-motion`
- Auth layout: `AuthShell` — charcoal panel + red accent (matches landing) — **out of scope for the 2026-07-18 redesign**, left untouched
- Toasts: `sonner` via `Providers`
- shadcn v4 / Base UI — **no `asChild`** on Button; use `buttonVariants` + `Link` instead
- Primary color (`--primary`) = brand accent red; do not introduce blue/purple as brand colors
- Tailwind v4 lint: use `bg-linear-to-br` (not `bg-gradient-to-br`); use canonical `bg-(--x)`/`text-(--x)` arbitrary-token syntax (not `bg-[var(--x)]`)

---

## 15. Coding conventions for AI / contributors

### Do

- Use **Server Components** by default; `"use client"` only for forms, hooks, interactivity
- Validate all API input with **Zod** schemas in `lib/validations/`
- Use `setUserPassword()` for any password change (keeps origin + encryption consistent)
- Use `serializeUserForAdmin()` for admin user API responses
- Use `requireAdmin()` / `requireSession()` in API routes
- Keep the real Drive sync push-only: Google (via Apps Script) calls the portal, never the reverse — the ZIP export bridge is the one deliberate, narrowly-scoped exception (`app/api/search/documents/export-zip/route.ts`)
- Run `npm run build` after significant changes
- Update **this file** when architecture changes

### Do not

- Import `lib/db` in Edge middleware or client bundles
- Import `lib/auth/password.ts` in client components (pulls pg) — use `lib/validations/password.ts` for zod only
- Store plaintext passwords in DB (except encrypted `adminVisiblePassword`)
- Return `webViewLink` / `viewUrl` for unauthorized files — denied docs get metadata only
- Commit `.env` or log SMTP credentials / reset links in production
- Create ADMIN users without business justification
- Use live Drive search without indexed DB — always query PostgreSQL
- Import `lib/mock/*` in app code — it is retired; only `scripts/validate-exercise-logic.ts` uses it

### Document index (PostgreSQL — live)

The app reads from the **PostgreSQL index**. In production this is populated by the Apps Script webhook (`POST /api/sync/apps-script`) pushing the real Drive tree; the local `npm run sync:exercise` path indexes `doc/debut` (10 employees, 110 PDFs, 7 sous-dossiers) for dev/testing only.

| Screen | Route | Data source | Access enforcement |
|--------|-------|-------------|-------------------|
| Dashboard home | `/dashboard` | `DashboardHub` (role-aware quick links + stats) | server-side |
| Document search | `/dashboard/search` | `GET /api/search/documents` → `lib/search/documents.ts`; Excel export via `/api/search/documents/export`; ZIP export via `/api/search/documents/export-zip` | server-side per request |
| Employee directory | `/dashboard/employees` | `listEmployees()` (server page) | — |
| Employee dossier | `/dashboard/employees/[matricule]` | `getEmployeeWithDocuments()` (server page); metadata grouped into themed sections in `employee-dossier.tsx` | server-side |
| Document completeness | `/dashboard/completeness` | Per-employee checklist against expected document types (`getDossierCompleteness()`) + manual attestations via `/api/completeness/verify` | server-side |
| Reporting | `/dashboard/reporting` | `getWorkforceDemographics()` (unscoped aggregate stats) + `getCompletenessOverview()` (permission-gated) | workforce stats unscoped; completeness overview server-side per viewer access |
| Document open | `/api/documents/[id]/view` | streams local PDF / redirects to Drive | server-side, denied → 404 |
| Sync status | `/admin/sync` | `getSyncOverview()` — read-only; no trigger button (real sync runs on the Apps Script side) | admin only |
| Permissions matrix | `/admin/permissions` | `User` + `AccessRule` | `/api/admin/permissions` |

- Sync first: index is empty until the Apps Script has pushed at least once (production) or `npm run sync:exercise` has been run (dev).
- Categories: `lib/document-category.ts` + Prisma `DocumentCategory` enum.
- `lib/permissions/defaults.ts` is client-safe; `access-rules.ts` is server-only (imports Prisma).
- `DemoBanner` was removed — the portal no longer distinguishes an "exercise" banner state from real data.
- Tests: `npm run test:exercise` (logic) + `npm run validate:sync` (DB vs local exercise filesystem — dev tool only).
- Roadmap: `doc/debut/exercice/ROADMAP.md`.

### Adding a new protected API route

1. Create `app/api/.../route.ts` with `export const runtime = "nodejs"`
2. Call `requireAdmin()` or `requireSession()`
3. `assertSafeMutation(request)` on POST/PATCH/PUT/DELETE
4. `parseJsonBody` + Zod validate
5. Consider `applyRateLimit`
6. Document in section 9 of this file

---

## 16. Email system

| `isSmtpConfigured()` | Behaviour |
|----------------------|-----------|
| false | Ethereal test account; dev preview URL in logs / yellow UI box |
| true | Real SMTP via nodemailer |

Templates: `lib/mail/templates.ts`  
Test: `POST /api/admin/mail/test` or `/admin` UI.

**SMTP lines in `.env` must not be commented out** (`#` disables them).

---

## 17. Local development notes

- PostgreSQL 18 on this machine often uses port **5433** (not 5432); the Windows service `postgresql-x64-18` can stop unexpectedly and needs an admin (`services.msc` or elevated PowerShell) to restart.
- After any `.env` change: **restart** `npm run dev`.
- Prisma 7 uses `prisma.config.ts` for `DATABASE_URL` (not in schema file).
- **Stale Turbopack `.next` cache** can cause intermittent 404s / `ClientFetchError` on NextAuth's catch-all route after repeated dev-server restarts. Fix: stop the server, delete `.next` (`rm -rf .next` or the Node equivalent on Windows), restart `npm run dev`.
- **`instrumentation.ts`'s `register()` only runs once at server boot — it does not hot-reload on file edits.** If you add logic there (e.g. the `dns.setDefaultResultOrder("ipv4first")` fix below), a dev server process already running will not pick it up; a stale process can silently keep failing after the fix is "in the code." Always fully stop and restart the dev server after editing this file.
- **Outbound `fetch()` to Google hosts (`script.google.com`, `script.googleusercontent.com`) can hang/`ConnectTimeoutError` on some networks** because Node/undici resolves an IPv6 address that blackholes the connection (curl on the same machine succeeds fine). Fixed globally via `node:dns`'s `setDefaultResultOrder("ipv4first")` in `instrumentation.ts`. If you see this again after the fix is present, suspect a stale server process (see above), not a regression.

---

## 18. Search & permissions

### Permissions (implemented — folder-level)

1. Admin edits matrix at `/admin/permissions` → `PATCH /api/admin/permissions`.
2. Rules stored in `AccessRule` per `(userId, category)`.
3. Every document read path (`/api/search/documents`, dossier page, `/api/documents/[id]/view`) calls `getResolvedAccessForUser(session.user.id, role)` server-side; unauthenticated/no-session renders fall back to `unauthenticatedAccess(role)`.

`lib/permissions/access-rules.ts` current exports: `ensureDefaultRolePermissions`, `unauthenticatedAccess`, `getRoleResolvedAccess`, `getResolvedAccessForUser`, `getEmployeeScopeForUser` / `setEmployeeScopeForUser`, `listPermissionMatrix`, `listRolePermissions`, `setCategoryAccess`, `setUserAccessBulk`, `setColumnAccessForAllUsers`, `setRolePermission` (plus re-exports of `canViewCategoryFromMap` / `canViewDocument` / `getDefaultAccessMap` from `./defaults`).

### Search flow (implemented — PostgreSQL, live as-you-type)

1. UI debounces input 300 ms and calls `GET /api/search/documents` (previous request aborted).
2. **Full-text on any Base sheet info:** the sync stores all 44 Base columns in `Employee.metadata` (label → value) and a normalized `Employee.searchText` blob (lowercase, accent-stripped). Query is tokenized; all tokens must match (`AND` of `contains`). Searching `AB123456` (CIN), `Master Gestion`, `Casa Centre`, or a responsable's name all work.
3. File-level match still applies (`name`, `documentType`, insensitive `contains`).
4. **Filters:** category, genre (H/F), age range (`minAge`/`maxAge`), minimum children (derived from `_Enfant_` filename tokens — 0 for all exercise files).
5. For each document: check viewer's `CategoryAccessMap` — `employeeId` scope planned.
6. Response: `{ fileName, category, employee, authorized, viewUrl? }` — **no `viewUrl` when denied**.
7. Opening a file goes through `/api/documents/[id]/view` (re-checks access; local stream now, Drive redirect in 2b).

`Employee` typed columns for filters: `genre`, `cin`, `age`, `anciennete`, `direction`, `service`, `poste`, `statut`, `situation`, plus (2026-07-01) `entite`, `sousEntite`, `zone`, `agence`, `college`, `admTech`, `position`, `encadrant`, `niveau`, `grade`, `categorieRh`, `managerMatricule`, `dateEntree`, `dateDepart`, `hasSpouseDocument`. UI groups these into 4 categorized, collapsible sections (`components/dashboard/search-filters/*`) driven by one `useReducer` filters object (`components/dashboard/search-filters/reducer.ts`); `direction`/`service`/etc. populate as dropdowns from `GET /api/search/filter-options` (distinct DB values). The dossier page shows the full "État personnel" panel from `metadata`. The annuaire filters client-side against `searchText`.

**Excel export:** `GET /api/search/documents/export` shares the same filter schema and `lib/search/documents.ts` query builder as the live search (`searchDocumentsForExport()`), but is uncapped (`EXPORT_ROW_LIMIT`, default 20,000) and excludes any document the viewer isn't authorized to see **before** building rows — denied documents never appear in the file, matching Model B. Built in-memory with `exceljs` (`workbook.xlsx.writeBuffer()`), one row per document: every `Employee.metadata` column (original French Base headers) + `Enfants (nb)` / `Conjoint au dossier` / document category / type / filename / modified date / absolute Drive-or-local link.

### Sync flow — real path (Google Apps Script push, production)

1. A time-driven trigger (or a manual run from the Apps Script editor) executes `runSync()` in `scripts/apps-script/sync.gs`, using native `DriveApp`/`SpreadsheetApp` services under the company's own Workspace identity — never the Drive REST API or a service account.
2. The script walks the Base sheet + Drive folder tree, batches employees/files into chunks, signs each request (`Utilities.computeHmacSha256Signature`), and `UrlFetchApp.fetch(POST)`s them to `POST /api/sync/apps-script`.
3. The route verifies the HMAC signature + timestamp, validates the payload (`lib/validations/drive-sync.ts`), and calls the shared `reconcileDriveIndex()` (upsert `Employee`/`DriveFile`, derive `childrenCount`/`hasSpouseDocument`).
4. On the final chunk (`isFinal: true`): stale `DriveFile` rows (not touched by this run) are deleted and the `SyncLog` is closed with counts.
5. There is **no button in the admin UI to trigger this** — `/admin/sync` is read-only (`getSyncOverview()`); the scheduler/trigger button was deliberately removed once the portal moved off local-only files (production data comes from the Apps Script's own schedule, not a portal-side control).
6. Full details, deployment steps, and the ZIP-export bridge: `doc/APPS_SCRIPT_SYNC_SETUP.md`.

### Sync flow — local exercise path (CLI dev tool only)

1. Run `npm run sync:exercise` (no admin-UI equivalent).
2. `parseExcelBase()` imports the Base sheet → upsert `Employee` by matricule.
3. `StorageProvider.listFolders("")` → matricule folders → sous-dossiers → PDFs.
4. `folderToCategory()` + `parseFilename()` classify each file; upsert `DriveFile` via the same `reconcileDriveIndex()` core.
5. Stale `DriveFile` rows deleted; `SyncLog` written with `source: "local-exercise"`.
6. `npm run validate:sync` diffs DB vs filesystem (must be 0).

---

## 19. Open questions for RH / IT

**Resolved by `doc/debut` exercise (2026-06-10):**

1. ~~Exact names of 7–8 subfolders~~ → **7 fixed sous-dossiers** — see `doc/debut/exercice/DRIVE-STRUCTURE.md`
2. ~~Sample filenames (children folder)~~ → `_Enfant_{Prénom}` patterns in `doc/debut/exercice/CODIFICATION.md`

**Resolved this session (2026-07-18):**

4. ~~Google Workspace service account + root folder access~~ → **not needed** — IT ruled out any Drive API/service-account use on the portal; sync is a Google Apps Script push using native `DriveApp`/`SpreadsheetApp` services under the company's own Workspace identity (see `doc/APPS_SCRIPT_SYNC_SETUP.md`)
6. ~~Acceptable sync frequency~~ → decided by the Apps Script's own time-driven trigger (set in the Apps Script UI), not a portal-side control — the admin "Synchroniser" button/scheduler was removed

**Still open:**

1. `Badge` in exercise but missing from Codification sheet — official key?
2. Complete codification for `7- Divers` (sheet has `Mle_` placeholders)
3. Production naming strictness (exercise uses shortened labels vs full codification)
5. Permission matrix: per user × **sous-dossier** × employee? (exercise implies folder-level)
7. `Base` sheet import source (HRIS export schedule / API)
8. Meaning of column `FA` in état personnel

---

## 20. Related documentation

| File | Purpose |
|------|---------|
| `README.md` (root) | Entry point — prerequisites, quick start, npm scripts reference |
| `doc/VISUAL_IDENTITY.md` | Brand colors, typography, layout patterns |
| `doc/FEATURE_IDEAS.md` | Backlog / deferred refinements |
| `doc/DEPLOYMENT.md` | IT/production prerequisites — hosting, DB, SMTP, env vars |
| `doc/APPS_SCRIPT_SYNC_SETUP.md` | Apps Script deployment, security model, ZIP export bridge, common setup mistakes |
| `SECURITY.md` | Security details |
| `doc/debut/README.md` | RH exercise sample data index (xlsx + Drive folder) |
| `doc/debut/exercice/README.md` | Exercise developer documentation index |
| `doc/debut/exercice/ROADMAP.md` | Phase 2a–4 implementation roadmap from exercise |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-19 | **Docs sync — reporting dashboard, completeness attestations, employee scope:** documented `/dashboard/reporting` (workforce demographics + completeness overview, `lib/reporting/stats.ts`, `recharts`), `POST`/`DELETE /api/completeness/verify` + the `CompletenessAttestation` model (manual "checked" annotation layered on the still-fully-derived completeness computation), and the `EmployeeScope` model (per-user direction/service scoping, Phase 4) — all of which existed in code but weren't yet reflected here |
| 2026-07-19 | **Documentation overhaul for handoff:** removed 3 obsolete LaTeX docs (`GUIDE-RH-GOOGLE-DRIVE`, `IT_REQUIREMENTS`, `APPS_SCRIPT_MIGRATION_GUIDE` + build artifacts) that described the abandoned direct-Drive-API/service-account architecture; removed redundant `DOCUMENTATION.md`, `SETUP.md`, `doc/HOW_TO_RUN.md`, `doc/README.md`, `project_infos.md` (superseded, stale — wrong Next.js version, wrong schema, wrong env var names); added `doc/DEPLOYMENT.md` (accurate IT/production prerequisites) and a rewritten root `README.md` as the single entry point; fixed stale `getCategoryAccessForUser` references (renamed to `getResolvedAccessForUser`) |
| 2026-07-18 | **ZIP export bridge:** `GET /api/search/documents/export-zip` builds a folder-structured ZIP of search-result PDFs by calling out to a `doPost(e)` Web App deployed from `scripts/apps-script/sync.gs` — the one deliberate reversal of the "portal never calls Google" rule; envelope-based HMAC signing (`signWebhookPayload`) since Apps Script's `doPost` can't read custom headers; `lib/search/zip-export.ts` (manifest builder), row-limited to 150; fixed a real `ConnectTimeoutError`/DNS issue via `dns.setDefaultResultOrder("ipv4first")` in `instrumentation.ts` |
| 2026-07-18 | **Full portal redesign** (branch `redesign/portal-v2`, merged to `main`): Newsreader serif display font, elevation shadow tokens, semantic status color tokens, `Panel`'s `elevated` prop, `StatTile`, `.enter-fade`/`.lift-on-hover` motion utilities, dossier metadata grouped into themed sections; `DemoBanner` removed entirely (landing/login pages explicitly untouched) |
| 2026-07-18 | **Excel parser bug fix:** `parseExcelBase.ts`'s `cellToText()` silently dropped styled/rich-text hyperlink cells (e.g. E-Mail column) — now recursively unwraps `value.text` |
| 2026-07-18 | **Real Google Apps Script Drive sync (Phase 2b) shipped:** `POST /api/sync/apps-script` webhook (HMAC-signed, replay-protected), `reconcileDriveIndex()` extracted as the shared provider-agnostic core, `scripts/apps-script/sync.gs` reference script, verified end-to-end against a real personal Google account and Drive folder |
| 2026-07-18 | **Local-exercise sync scheduler/button removed** from the admin UI (`SyncSchedule` model, `lib/sync/scheduler.ts`, `app/api/admin/sync/schedule/route.ts` deleted) — the portal moved off local-only files; `/admin/sync` is now read-only, production sync runs on the Apps Script's own trigger |
| 2026-07-01 | **Advanced search + Excel export:** ~15 new typed `Employee` columns (org/dates/derived) + `hasSpouseDocument` (from `_Conjoint` filename token, mirrors `childrenCount`); categorized 4-group filter UI (`components/dashboard/search-filters/*`, `useReducer`-driven); `GET /api/search/filter-options` (dropdown values); `GET /api/search/documents/export` (access-filtered `.xlsx`, one row per document); shared `lib/validations/document-search.ts` schema; `components/ui/collapsible.tsx` |
| 2026-06-14 | Toast styling: removed Sonner `richColors` (dark green); light card + status left accent aligned with brand tokens |
| 2026-06-10 | **Search on any employee info:** all 44 Base columns synced (`Employee.metadata` + normalized `searchText`, typed `genre`/`cin`/`age`/`anciennete`); tokenized full-text search; genre + age filters; live as-you-type search (300 ms debounce, request abort); dossier "État personnel" panel; CIN in annuaire |
| 2026-06-10 | **Phase 2a + 3 (local):** `Employee`/`DriveFile`/`SyncLog` models; `LocalFolderProvider`; `syncDriveIndex()`; `/api/admin/sync`; PostgreSQL search (`/api/search/documents`); authorized PDF streaming (`/api/documents/[id]/view`); app code off `lib/mock`; `exceljs` dep; `sync:exercise` / `validate:sync` scripts |
| 2026-06-10 | Docs sync: Phase 4 partial status, permissions architecture, `test:exercise` / `mock:exercise` scripts |
| 2026-06-10 | `DemoBanner` → Server Component (fixes hydration mismatch with stale Turbopack client bundle) |
| 2026-06-10 | `scripts/validate-exercise-logic.ts` + `npm run test:exercise` (525 assertions) |
| 2026-06-10 | Real permissions: `AccessRule` model, `/api/admin/permissions`, matrix uses portal `User` records from DB |
| 2026-06-10 | Mock layer aligned to RH exercise (10×110, 7 folders); `lib/document-category.ts`; `doc/debut/exercice/ROADMAP.md` |
| 2026-06-10 | RH exercise documented in `doc/debut/exercice/`; `TECHNICAL.md` moved to `doc/`; `DocumentCategory` enum aligned to 7 sous-dossiers |
| 2026-05-30 | Mock UI: RH search dashboard, admin sync/permissions previews, `lib/mock/` |
| 2026-05-30 | Brand identity rolled out app-wide; `doc/VISUAL_IDENTITY.md`; global `--brand-*` tokens |
| 2026-05-30 | Mock multi-page UI: RH search/annuaire/dossier; admin overview, sync, permissions; `lib/mock/*` |
| 2026-05-26 | Initial TECHNICAL.md — Phase 1 complete |
