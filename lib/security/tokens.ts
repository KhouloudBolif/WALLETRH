import { createHash, randomBytes, timingSafeEqual } from "crypto";

/** Store only the hash of reset tokens in the database. */
export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function verifyTokenHash(raw: string, storedHash: string): boolean {
  try {
    const a = Buffer.from(hashToken(raw), "hex");
    const b = Buffer.from(storedHash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
