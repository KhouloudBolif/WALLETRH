# RH exercise data — developer reference (`doc/debut/exercice`)

> **Purpose:** Canonical reference for the sample data RH provided to validate the Portail RH architecture.
> **Use when:** Testing the Google Apps Script sync against real-shaped data, designing Prisma models, or building search/permissions.
> **Last updated:** 2026-07-14

---

## Contents (parent folder `doc/debut/`)

| Asset | Path | Description |
|-------|------|-------------|
| Excel workbook | `../Etat personnel exercice.xlsx` | HR master data + file inventory + naming codification (3 sheets) |
| Drive export | `../Dossiers Digitaux/` | Downloaded Drive tree — 10 employee folders, 110 PDFs |
| Documentation | `doc/debut/exercice/*.md` | Parsed specs (this folder) |

---

## Documentation index

Read in this order for a full picture:

| # | File | What it covers |
|---|------|----------------|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | How Excel + Drive relate; exercise scope; key findings |
| 2 | [DRIVE-STRUCTURE.md](./DRIVE-STRUCTURE.md) | Folder tree, file naming rules, exercise inventory |
| 3 | [EXCEL-SHEETS.md](./EXCEL-SHEETS.md) | **Base**, **Arborescence**, **Codification** — columns, layout, parsing notes |
| 4 | [CODIFICATION.md](./CODIFICATION.md) | Full production document-type catalog per sous-dossier |
| 5 | [ROADMAP.md](./ROADMAP.md) | Current implementation status and what's left |

---

## Quick facts (cheat sheet)

```
Drive root
└── Dossiers Digitaux/
    └── {matricule}/          # e.g. 100001 — matches Base.Matricule
        ├── 1- Recrutement/
        ├── 2- Etat Civil/
        ├── 3- Arrêtés/
        ├── 4- Mesures Disciplinaires/
        ├── 5- Maladies et Accidents de Travail/
        ├── 6- Départ/
        └── 7- Divers/        # may be empty

Filename pattern:  {matricule}_{document_label}.pdf
Codification uses: Mle_{document_label}   (Mle = matricule placeholder)
```

| Metric | Value |
|--------|-------|
| Employees in exercise | 10 (matricules 100001–100010) |
| PDFs per employee | 11 |
| Total PDFs | 110 |
| Sous-dossiers | 7 (fixed set) |
| Excel ↔ Drive match | 100% (after apostrophe/encoding normalization) |

---

## Relationship to main project docs

| Doc | Link |
|-----|------|
| Living technical spec | [TECHNICAL.md](../../TECHNICAL.md) |
| Project setup / getting started | [README.md](../../../README.md) |
| Apps Script sync setup + security model | [APPS_SCRIPT_SYNC_SETUP.md](../../APPS_SCRIPT_SYNC_SETUP.md) |
| IT/production prerequisites | [DEPLOYMENT.md](../../DEPLOYMENT.md) |
| Reference Apps Script | `scripts/apps-script/sync.gs` |
| Mock UI (retired, kept only for `npm run test:exercise`) | `lib/mock/*` |

**App status:**

| Feature | Status |
|---------|--------|
| Document index in PostgreSQL (10 employees, 110 PDFs) | ✅ `npm run sync:exercise` (CLI dev tool, not exposed in the admin UI) |
| Folder permissions (portal users) | ✅ `AccessRule` in PostgreSQL — `/admin/permissions` |
| Search / dossier / document open enforcement | ✅ server-side per request |
| Authorized PDF streaming | ✅ `/api/documents/[id]/view` |
| Drive sync — Google Apps Script push (no Drive API / service account) | ✅ `POST /api/sync/apps-script` + `scripts/apps-script/sync.gs` — verified end-to-end against a real Google account, including the real exercise data |
| `/admin/sync` sync trigger / schedule | ❌ removed — see note below |

Tests: `npm run test:exercise` (logic) · `npm run validate:sync` (DB vs filesystem, local path only)

**Important:** `/admin/sync` is now a **read-only status view** of Apps-Script-driven syncs (history, counts) — it has no button and no scheduler. There is no way for the portal to trigger a real sync; that can only happen from the Apps Script editor (manual run) or its own time-driven trigger, per the architecture constraint (no Drive API calls from the portal). The local-exercise sync (`npm run sync:exercise`) still exists as a CLI-only dev tool but is no longer reachable from the UI — it was removed after it accidentally overwrote real Apps-Script-synced data during testing (both paths share the same `Employee`/`DriveFile` tables with global stale-removal).

---

## Open questions for RH (still pending)

1. **Badge** — present in exercise (`2- Etat Civil`) but missing from Codification sheet.
2. **7- Divers** — folder exists; codification incomplete (`Mle_` placeholders); empty in exercise.
3. **Short vs full labels** — exercise uses shortened names (`Contrat` vs `Contrat de travail`). Confirm production naming strictness.
4. **External managers** — matricules like 100020 appear in Base but have no Drive folder in this sample.
5. **Identity mapping** — do portal accounts correspond to real company Google Workspace accounts? Blocks any future Drive-permission automation.
6. **Search filters** — which employee/document filters RH actually needs day to day (see `lib/search/documents.ts` for what's already supported).
