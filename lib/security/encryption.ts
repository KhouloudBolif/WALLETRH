import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const material =
    process.env.ENCRYPTION_KEY?.trim() ?? process.env.AUTH_SECRET?.trim();

  if (!material || material.length < 32) {
    throw new Error(
      "[security] ENCRYPTION_KEY or AUTH_SECRET (32+ chars) required for password encryption",
    );
  }

  return scryptSync(material, "rh-portail-field-encryption", 32);
}

/** Encrypts admin-viewable passwords at rest in the database. */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const key = getEncryptionKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptField(payload: string): string | null {
  if (!payload.startsWith(PREFIX)) {
    return null;
  }

  try {
    const parts = payload.slice(PREFIX.length).split(".");
    if (parts.length !== 3) return null;

    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const data = Buffer.from(dataB64, "base64url");
    const key = getEncryptionKey();

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}
