# Drive sync via Google Apps Script

IT does not allow the portal to call the Google Drive API directly (no
`googleapis` OAuth client / service account). Instead, a Google Apps Script
running under the company's own Workspace authorization pushes the Drive
folder tree + Base sheet to the portal, which reconciles its database.

Reference script: `scripts/apps-script/sync.gs` (copy into a new Apps Script
project — it is not part of the Next.js build).

## Why this satisfies the "no Drive API" constraint

Apps Script's built-in `DriveApp` / `SpreadsheetApp` services run inside
Google's own script runtime, under the company's Workspace identity. They are
not the external Drive REST API and require no OAuth client, service account,
or credentials held by the portal. The portal never talks to Google — Google
(via the script) talks to the portal over one authenticated webhook.

## Setup

1. **Create the script.** Go to script.google.com, create a new project (or
   bind it to the Base spreadsheet via Extensions > Apps Script). Paste in
   `scripts/apps-script/sync.gs`.
2. **Set Script Properties** (Project Settings > Script Properties):
   - `PORTAL_WEBHOOK_URL` — e.g. `https://<your-domain>/api/sync/apps-script`
   - `SYNC_SECRET` — a long random value (e.g. `openssl rand -base64 32`)
   - `ROOT_FOLDER_ID` — the Drive folder id containing one subfolder per
     matricule
   - `BASE_SHEET_ID` — the spreadsheet id of "Etat personnel exercice" (the
     "Base" sheet)
3. **Set the matching portal env var.** `DRIVE_SYNC_WEBHOOK_SECRET` must equal
   the `SYNC_SECRET` value above, on every environment (dev/staging/prod use
   distinct secrets — never share one across environments).
4. **Least privilege.** Run the script under a dedicated Workspace account (or
   the script owner's account) that only has access to the HR dossier root
   folder and the Base sheet — not domain-wide Drive access.
5. **Install a time-driven trigger.** In the Apps Script editor: Triggers >
   Add Trigger > `runSync` > Time-driven > every 30 minutes (adjust to taste).
   `testRunSyncManually` is provided for on-demand runs while testing.

## How a run works

1. The script reads the Base sheet and walks `{matricule}/{sous-dossier}/*`
   under the root folder.
2. It POSTs the file listing in chunks (500 files/request) to
   `/api/sync/apps-script`, HMAC-signed (`X-Signature` / `X-Timestamp`
   headers). The first request includes the parsed employee rows; the server
   creates a `SyncLog` row and returns its id, which subsequent chunk requests
   echo back so counts accumulate on the same row.
3. The last request sets `isFinal: true`, which tells the portal to delete any
   `DriveFile` row not touched during this run (stale removal) and mark the
   `SyncLog` `SUCCESS`.
4. All filename/folder parsing (document category, matricule, child/spouse
   detection) happens server-side in `lib/storage/codification.ts` and
   `lib/sync/syncDriveIndex.ts`'s `reconcileDriveIndex()` — the script is a
   thin transport, not a second implementation of that logic.

## Reliability hardening

- **Overlap guard**: `runSync()` acquires `LockService.getScriptLock()`
  (non-blocking `tryLock(0)`) before doing anything. If a previous execution
  is still running when the next trigger fires — e.g. the Drive tree grew
  large enough that a run now takes longer than the trigger interval — the
  new run logs a skip message and exits immediately instead of hitting the
  portal concurrently with the still-running one. Apps Script releases the
  lock automatically when an execution ends, so a crashed run can never leave
  a stale lock behind (unlike a hand-rolled Script Property flag would).
- **Retry on transient failures**: each chunk POST is retried up to 4 attempts
  (delays: 2s, 5s, 15s) if the portal is briefly unreachable (network error)
  or returns a 5xx (e.g. mid-redeploy). A 4xx response (bad signature,
  invalid payload) fails immediately without retrying, since retrying can't
  fix a validation or auth error. If all attempts are exhausted, the run
  throws and Apps Script emails the script owner — the next scheduled trigger
  will pick it up from scratch (the sync is a full reconcile, not a delta, so
  there's nothing to "resume").

## Common setup mistakes (hit these during the first real dry run)

- **`Error: Sheet "Base" not found`, even though the tab looks right.** The
  tab name needs an *exact* match — a trailing space from double-clicking to
  rename (`"Base "` instead of `"Base"`) is invisible in the UI but fails
  `getSheetByName("Base")`. If you hit this, add a temporary debug function
  to confirm what Apps Script actually sees:
  ```js
  function debugListSheets() {
    const id = PropertiesService.getScriptProperties().getProperty("BASE_SHEET_ID");
    const ss = SpreadsheetApp.openById(id);
    Logger.log(JSON.stringify(ss.getSheets().map(function (s) { return s.getName(); })));
  }
  ```
- **Base sheet row layout.** Row 1 is skipped, row 2 must be the header row,
  data starts row 3 — matching the real Excel export's layout. It's easy to
  put headers in row 1 by mistake when building a quick test sheet.
- **401 "Non autorisé" that only appears once real (non-ASCII) data is in the
  payload.** This is why `postToPortal_` passes `Utilities.Charset.UTF_8`
  explicitly to `computeHmacSha256Signature` — without it, accented
  characters from the Base sheet (`Prénom`, `Date d'Entrée`, …) can produce a
  signature that doesn't match what the portal recomputes from the actual
  UTF-8 bytes it received over the wire. A payload with only ASCII content
  can pass while the real Base-sheet data fails, which makes this easy to
  misdiagnose as a secret mismatch. Make sure your copy of `sync.gs` has the
  explicit `Utilities.Charset.UTF_8` argument.
- **Quick-tunnel URLs for local testing are not stable.** If you're testing
  against a local dev server via `cloudflared tunnel --url http://localhost:3000`
  (no account needed) or ngrok, the URL changes every time the tunnel process
  restarts — update `PORTAL_WEBHOOK_URL` again if the tunnel drops. Not a
  concern once the portal is on a real deployed domain.

## ZIP export bridge (search results → downloadable ZIP)

The search page's "Télécharger (ZIP)" button needs actual file bytes, which
the portal still never touches directly. Instead the **portal calls out to
the same Apps Script project** — the one place in this whole design where the
direction reverses (everywhere else, Google calls the portal).

1. **Deploy `doPost(e)` as its own Web App.** In the Apps Script editor:
   Deploy > New deployment > type **Web app** > Execute as **Me** > Who has
   access **Anyone**. Copy the resulting `.../exec` URL.
2. **Set the portal env var** `APPS_SCRIPT_EXPORT_URL` to that URL. It reuses
   the existing `DRIVE_SYNC_WEBHOOK_SECRET` / `SYNC_SECRET` — no new secret.
3. **How it's authenticated**: Apps Script's `doPost(e)` cannot read custom
   HTTP headers (unlike the portal's own Next.js routes), so the signature
   travels *inside* the JSON body instead of as a header:
   `{ timestamp, signature, payload: "<exact string that was signed>" }`.
   `verifyEnvelope_()` in `sync.gs` re-derives the HMAC over
   `timestamp + "." + payload` and compares it with a constant-time check
   (`timingSafeEqual_`, since Apps Script has no built-in equivalent).
4. **What it does**: the portal re-runs the search server-side (never trusts
   a client-supplied file list), resolves each result's real Drive file ID by
   extracting it from `webViewLink` (the only place it's persisted — the
   `DriveFile.driveFileId` column is a stable hash, not the real Drive ID),
   and sends `{ items: [{ fileId, path }] }` where `path` is the full in-zip
   location (`{matricule} - {nom}/{catégorie}/{fichier}`). Apps Script fetches
   each blob via `DriveApp.getFileById()`, renames it to that path (the `/`
   in the name becomes nested zip folders), and bundles everything with the
   built-in `Utilities.zip()` — no external library needed.
5. **Limits**: capped at `ZIP_EXPORT_ROW_LIMIT` (150) results — both because
   base64-encoding the zip for the JSON response adds ~33% overhead against
   Apps Script's response-size ceiling, and because fetching that many blobs
   serially eats into the 6/30-minute execution ceiling. A user exceeding it
   gets a clear "affinez la recherche" error, not a timeout.
6. **Failure mode**: any file that can't be read (moved, deleted, permission
   issue) is skipped rather than failing the whole export — the response
   carries an `X-Export-Zip-Skipped` count and the UI surfaces it as a toast.

## Security model

- **Authentication**: HMAC-SHA256 signature over `${timestamp}.${rawBody}`
  with the shared secret, verified with a timing-safe comparison
  (`lib/security/webhook-signature.ts`). There is no session/browser Origin
  for this caller, so this replaces the CSRF-style origin check used on other
  mutating routes.
- **Replay protection**: requests older than 5 minutes are rejected.
- **Validation**: strict zod schema (`lib/validations/drive-sync.ts`) with
  array-size caps; unknown fields rejected.
- **Body size cap**: 2MB per request (chunking keeps individual requests well
  under this).
- **Rate limiting**: existing `applyRateLimit` helper, 30 requests/hour.
- **No blast radius on the rest of the app**: this is one new, additive route.
  Session-based auth (`requireAdmin`/`requireSession`), per-category
  `AccessRule` checks on `/api/documents/[id]/view`, and all other routes are
  unchanged.
- **Secret hygiene**: rotate `SYNC_SECRET`/`DRIVE_SYNC_WEBHOOK_SECRET`
  periodically; never commit it; use distinct values per environment.

## Testing before go-live

1. `npm run build` — typecheck the whole app after pulling these changes.
2. `npm run sync:exercise` then `npm run validate:sync` — confirms the local
   exercise sync path (used by dev/tests) still works after the
   `reconcileDriveIndex` refactor.
3. Local webhook dry run: craft a small JSON payload and a matching HMAC
   signature (see the project's test script under `scripts/` if present, or
   compute one with Node's `crypto.createHmac`), POST it to
   `http://localhost:3000/api/sync/apps-script`, and confirm in `/admin` that
   a new `SyncLog` row appears and `DriveFile` rows are created.
4. Negative tests: wrong signature → 401; stale timestamp → 401; malformed
   payload → 400; oversized body → 413. None of these should leave a
   dangling `RUNNING` `SyncLog` row.
5. Stale-removal test: run once with 3 files (`isFinal: true`), then again
   with 1 file (`isFinal: true`) — confirm the other 2 `DriveFile` rows are
   deleted and `SyncLog.filesRemoved` reflects it.
6. End-to-end with the real script: point `ROOT_FOLDER_ID`/`BASE_SHEET_ID` at
   a small test folder/sheet (2–3 dummy employees, a couple of PDFs each),
   run `testRunSyncManually` from the Apps Script editor, then check: the
   admin dashboard shows a `SUCCESS` sync; the employee dossier lists the
   files; clicking "view" on a file opens the correct Drive link and still
   respects the employee's category access rules.
