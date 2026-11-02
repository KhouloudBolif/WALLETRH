import { encryptZipBytes } from "@/lib/search/encrypt-zip";

/** Décode un ZIP base64 puis le chiffre AES-256. */
export async function encryptZipBase64(
  zipBase64: string,
  password: string,
): Promise<Uint8Array> {
  const binary = atob(zipBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return encryptZipBytes(bytes, password);
}

export function zipBytesToBlob(encrypted: Uint8Array): Blob {
  const copy = new Uint8Array(encrypted.byteLength);
  copy.set(encrypted);
  return new Blob([copy], { type: "application/zip" });
}
