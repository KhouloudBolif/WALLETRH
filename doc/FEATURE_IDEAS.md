# Feature ideas — backlog

> Not started. Captured 2026-07-06 so these don't get lost. Pick items up as separate tasks — see [TECHNICAL.md](./TECHNICAL.md) for architecture context and [VISUAL_IDENTITY.md](./VISUAL_IDENTITY.md) for UI conventions before implementing.

## Already on the RH/product backlog

- ~~**Missing-documents / incomplete-dossier detection**~~ — **Shipped** (2026-07-07) as `/dashboard/completeness` — see `doc/debut/exercice/CODIFICATION.md` for the source catalog, `lib/document-types.ts` for the tracked-type list, `lib/search/documents.ts` → `getDossierCompleteness()` for the logic. Purely read-only/derived (no persisted "resolved" state — a gap disappears on its own once the file is uploaded and a sync re-runs). Deferred refinements below.

### Completeness page — deferred refinements

- **Per-family-member tracking** — spouse/child document variants (`CIN_Conjoint`, `*_Enfant_*`) are currently collapsed into their base document type rather than tracked individually. `Employee.childrenCount` and `Employee.hasSpouseDocument` already exist and could drive a per-relation checklist later.
- **Mesures Disciplinaires / Maladies & AT** are intentionally excluded from the completeness catalog — both are conditional on events that may never happen to a given employee, with no eligibility signal available today to know who's exempt. Revisit if a reliable signal (e.g. an explicit "a disciplinary case was opened" flag) ever gets modeled.

## Data & export

- ~~**ZIP export of search results**~~ — **Shipped** (2026-07-18) as `GET /api/search/documents/export-zip`: builds a per-employee/per-category-folder ZIP of the matching PDFs by calling out to an Apps Script Web App bridge (`scripts/apps-script/sync.gs` → `doPost`). Capped at 150 rows; skipped files reported to the user. See `doc/APPS_SCRIPT_SYNC_SETUP.md` for the security model. This was the one deliberate exception to "the portal never calls Google."
- **Excel export for Employee Directory & Users list** — reuse the existing `exceljs` + `/api/search/documents/export` pattern (`lib/search/documents.ts` → `searchDocumentsForExport()`) for `/dashboard/employees` and `/admin/users`. (Document search itself already has both Excel and ZIP export — this idea is about extending the pattern to the other list views.)
- **Saved filter presets** in document search ("mes recherches favorites") — the filter set has grown to 4 groups / ~30 fields; letting users save/name a combination would help repeat searches.
- **Column visibility toggle** on dense tables (employee directory already hides CIN/service on mobile; letting desktop users choose visible columns would help power users).

## Admin & operations

- **Audit log for admin actions** — nothing currently records *who* changed a permission or deactivated a user (only `SyncLog` tracks sync runs). Extend the same log-table pattern to permission/user changes for accountability on an HR tool handling PII.
- **Bulk actions** in Permissions/Users — multi-select rows → bulk enable/disable, bulk grant a folder. The matrix already has row/column "Tout/Aucun" shortcuts; multi-row select is the natural next step.
- **Sync failure email alert to admins** — SMTP is already wired up for admin test emails (`lib/mail`); extend it to auto-notify on a failed `POST /api/admin/sync` run.

## Navigation & UX

- **Command palette / quick-jump (Cmd+K)** — jump straight to an employee dossier by matricule/CIN, or to an admin page. High value for a lookup-first tool.

## Roadmap reminders (already documented in TECHNICAL.md, just flagging again)

- ~~**Phase 2b — Google Drive service-account connection**~~ — **Resolved differently and shipped** (2026-07-18): IT ruled out any Drive API/service account on the portal, so this was implemented instead as a Google Apps Script push (native `DriveApp`/`SpreadsheetApp`, `POST /api/sync/apps-script` webhook) — see `doc/APPS_SCRIPT_SYNC_SETUP.md`. The admin-UI "Synchroniser" button/scheduler was deliberately removed once the portal moved off local-only files; production sync now runs on the Apps Script's own time-driven trigger.
- **Phase 4 (partial) — per-employee access scope** — `AccessRule.employeeId` is already commented in the Prisma schema as planned but unused; permissions are folder-level only today.

## Security hardening (flagged "not implemented" in TECHNICAL.md §13)

- **MFA/TOTP for admin accounts** — worth prioritizing given admins can view other users' passwords (`adminVisiblePassword`).
- **Redis-backed rate limiting** — current limiting (`lib/security/rate-limit.ts`) is in-memory only, so it resets on every restart/deploy and won't work across multiple instances.
