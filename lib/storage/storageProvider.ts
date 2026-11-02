/**
 * Storage provider abstraction — used for the local exercise/dev sync path only.
 *
 * Phase 2a: LocalFolderProvider scans doc/debut/Dossiers Digitaux.
 * Phase 2b (production Drive sync): the company does not allow the portal to call
 * the Google Drive API directly. Instead, a Google Apps Script running under the
 * company's Workspace (DriveApp/SpreadsheetApp — not the Drive REST API) pushes the
 * current folder/file listing to POST /api/sync/apps-script, which calls
 * lib/sync/syncDriveIndex.ts's reconcileDriveIndex() directly — bypassing this
 * provider interface entirely. See scripts/apps-script/sync.gs and
 * docs/apps-script-sync-setup.md.
 */

import { LocalFolderProvider } from "@/lib/storage/localFolderProvider";

export type StorageFile = {
  /** Stable backend id — Drive file ID, or relative path for the local provider */
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  parentId?: string;
  modifiedAt?: Date;
};

export type StorageFolder = {
  id: string;
  name: string;
  parentId?: string;
};

export interface StorageProvider {
  /** Human-readable source name persisted in SyncLog.source */
  readonly source: string;
  /** List direct subfolders ("" = root) */
  listFolders(parentId: string): Promise<StorageFolder[]>;
  /** List direct files of a folder */
  listFiles(folderId: string): Promise<StorageFile[]>;
  getFile(fileId: string): Promise<StorageFile | null>;
  /** Absolute filesystem path for streaming (local provider only) */
  getLocalPath?(fileId: string): string;
}

let cachedProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!cachedProvider) {
    cachedProvider = new LocalFolderProvider();
  }
  return cachedProvider;
}
