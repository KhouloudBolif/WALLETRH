import type { DocumentExportRow } from "@/lib/search/documents";
import { categoryFilterLabels } from "@/lib/document-category";

/** Apps Script execution + payload size make this a firm ceiling, not a preference. */
export const ZIP_EXPORT_ROW_LIMIT = 150;

const DRIVE_FILE_ID_RE = /\/d\/([a-zA-Z0-9_-]+)/;

/** Extracts the raw Drive file ID from a `webViewLink` (the only place it's persisted —
 * `DriveFile.driveFileId` is a stable hash, not the real Drive ID). */
export function extractDriveFileId(webViewLink: string): string | null {
  const match = webViewLink.match(DRIVE_FILE_ID_RE);
  return match ? match[1] : null;
}

/** Zip entry names double as folder paths — strip characters that break that on
 * common filesystems/zip tools, without over-sanitizing accented French text. */
function sanitizeSegment(segment: string): string {
  return segment.replace(/[\\/:*?"<>|]/g, "_").trim() || "_";
}

export type ZipManifestItem = {
  fileId: string;
  /** Full path inside the zip, e.g. "100001 - Youssef El Amrani/2- Etat Civil/100001_CIN.pdf" */
  path: string;
};

/** Builds the { fileId, path } list sent to the Apps Script zip bridge, skipping
 * any row we can't resolve a real Drive file ID for (local-only / malformed link). */
export function buildZipManifest(rows: DocumentExportRow[]): {
  items: ZipManifestItem[];
  skipped: number;
} {
  const items: ZipManifestItem[] = [];
  let skipped = 0;

  for (const row of rows) {
    const fileId = row.webViewLink ? extractDriveFileId(row.webViewLink) : null;
    if (!fileId) {
      skipped += 1;
      continue;
    }

    const employeeFolder = sanitizeSegment(`${row.matricule} - ${row.displayName}`);
    const categoryFolder = sanitizeSegment(categoryFilterLabels[row.category]);
    const fileName = sanitizeSegment(row.fileName);

    items.push({ fileId, path: `${employeeFolder}/${categoryFolder}/${fileName}` });
  }

  return { items, skipped };
}
