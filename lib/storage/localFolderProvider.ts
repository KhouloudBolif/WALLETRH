/**
 * Local exercise storage provider — scans `doc/debut/Dossiers Digitaux`.
 *
 * Folder ids are relative POSIX-style paths from the root
 * (e.g. "100001/2- Etat Civil"); file ids are relative file paths.
 * Mirrors the Google Drive provider contract so the sync job is backend-agnostic.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  StorageFile,
  StorageFolder,
  StorageProvider,
} from "@/lib/storage/storageProvider";

const DEFAULT_ROOT = path.join(process.cwd(), "doc", "debut", "Dossiers Digitaux");

export class LocalFolderProvider implements StorageProvider {
  readonly source = "local-exercise";
  private readonly root: string;

  constructor(root = process.env.EXERCISE_DRIVE_ROOT ?? DEFAULT_ROOT) {
    this.root = root;
  }

  private toAbsolute(relativeId: string): string {
    const resolved = path.resolve(this.root, relativeId);
    if (!resolved.startsWith(path.resolve(this.root))) {
      throw new Error("Path escapes storage root");
    }
    return resolved;
  }

  private toId(...segments: string[]): string {
    return segments.filter(Boolean).join("/").normalize("NFC");
  }

  async listFolders(parentId: string): Promise<StorageFolder[]> {
    const dir = this.toAbsolute(parentId);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => ({
        id: this.toId(parentId, e.name),
        name: e.name.normalize("NFC"),
        parentId: parentId || undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  async listFiles(folderId: string): Promise<StorageFile[]> {
    const dir = this.toAbsolute(folderId);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: StorageFile[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".pdf")) continue;
      const id = this.toId(folderId, entry.name);
      const stat = await fs.stat(this.toAbsolute(id));
      files.push({
        id,
        name: entry.name.normalize("NFC"),
        mimeType: "application/pdf",
        parentId: folderId,
        modifiedAt: stat.mtime,
      });
    }

    return files.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  async getFile(fileId: string): Promise<StorageFile | null> {
    try {
      const abs = this.toAbsolute(fileId);
      const stat = await fs.stat(abs);
      if (!stat.isFile()) return null;
      return {
        id: fileId,
        name: path.basename(fileId).normalize("NFC"),
        mimeType: "application/pdf",
        modifiedAt: stat.mtime,
      };
    } catch {
      return null;
    }
  }

  getLocalPath(fileId: string): string {
    return this.toAbsolute(fileId);
  }
}
