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
  /** Chemin dans le ZIP. Racine si une seule catégorie, sinon « 2- Etat Civil/fichier.pdf ». */
  path: string;
};

function uniqueZipPath(path: string, used: Set<string>): string {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const slash = path.lastIndexOf("/");
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = file.lastIndexOf(".");
  const stem = dot > 0 ? file.slice(0, dot) : file;
  const ext = dot > 0 ? file.slice(dot) : "";
  let n = 2;
  let next = `${dir}${stem} (${n})${ext}`;
  while (used.has(next)) {
    n += 1;
    next = `${dir}${stem} (${n})${ext}`;
  }
  used.add(next);
  return next;
}

/** Builds the { fileId, path } list sent to the Apps Script zip bridge, skipping
 * any row we can't resolve a real Drive file ID for (local-only / malformed link).
 * Les fichiers sont à la racine du ZIP. S'il y a plusieurs dossiers mères
 * (catégories), chacun a son dossier, sans sous-dossier par employé. */
export function buildZipManifest(rows: DocumentExportRow[]): {
  items: ZipManifestItem[];
  skipped: number;
} {
  const pending: { fileId: string; folder: string; fileName: string }[] = [];
  let skipped = 0;

  for (const row of rows) {
    const fileId = row.webViewLink ? extractDriveFileId(row.webViewLink) : null;
    if (!fileId) {
      skipped += 1;
      continue;
    }

    const folder = sanitizeSegment(row.folderName || categoryFilterLabels[row.category]);
    const fileName = sanitizeSegment(row.fileName);
    pending.push({ fileId, folder, fileName });
  }

  const separateFolders = new Set(pending.map((item) => item.folder)).size > 1;
  const used = new Set<string>();
  const items = pending.map((item) => ({
    fileId: item.fileId,
    path: uniqueZipPath(
      separateFolders ? `${item.folder}/${item.fileName}` : item.fileName,
      used,
    ),
  }));

  return { items, skipped };
}
