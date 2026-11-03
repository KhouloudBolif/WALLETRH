import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from "@zip.js/zip.js";

/**
 * Re-packages a plain ZIP into an AES-256 password-protected ZIP.
 * Le mot de passe ne protège que l'archive : après extraction, les fichiers
 * (PDF compris) s'ouvrent sans mot de passe.
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
      const data = await entry.getData(new Uint8ArrayWriter());
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
