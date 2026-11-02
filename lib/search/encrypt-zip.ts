import { PDFDocument } from "@cantoo/pdf-lib";
import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from "@zip.js/zip.js";

/** Le mot de passe du ZIP ne survit pas à l'extraction. On verrouille aussi le PDF. */
async function protectPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  doc.encrypt({
    userPassword: password,
    ownerPassword: password,
  });
  return doc.save();
}

/**
 * Re-packages a plain ZIP into an AES-256 password-protected ZIP.
 * Les PDF reçoivent en plus le même mot de passe : il reste demandé après extraction.
 * Works in Node and in the browser (Apps Script has no password support).
 */
export async function encryptZipBytes(
  plainZip: Uint8Array,
  password: string,
): Promise<Uint8Array> {
  const reader = new ZipReader(new Uint8ArrayReader(plainZip));
  const entries = await reader.getEntries();

  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    password,
    encryptionStrength: 3,
  });

  try {
    for (const entry of entries) {
      if (entry.directory) {
        await writer.add(entry.filename, undefined, { directory: true });
        continue;
      }
      if (!entry.getData) continue;
      let data = await entry.getData(new Uint8ArrayWriter());
      if (entry.filename.toLowerCase().endsWith(".pdf")) {
        try {
          data = await protectPdf(data, password);
        } catch (error) {
          console.error("[encrypt-zip] PDF non verrouillé:", entry.filename, error);
        }
      }
      await writer.add(entry.filename, new Uint8ArrayReader(data), {
        password,
        encryptionStrength: 3,
      });
    }
  } finally {
    await reader.close();
  }

  return writer.close();
}

/** Node helper — wraps {@link encryptZipBytes}. */
export async function encryptZipWithPassword(
  plainZip: Buffer,
  password: string,
): Promise<Buffer> {
  const encrypted = await encryptZipBytes(new Uint8Array(plainZip), password);
  return Buffer.from(encrypted);
}
