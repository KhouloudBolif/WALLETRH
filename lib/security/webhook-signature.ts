import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Signs a payload the same way the Apps Script sync push does, but in the
 * opposite direction — used when the portal calls out to an Apps Script Web
 * App (e.g. the ZIP export bridge) and needs the script to verify it's really
 * the portal calling.
 */
export function signWebhookPayload(rawBody: string, secret: string) {
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return { timestamp, signature };
}

/**
 * Verifies an HMAC-SHA256 signature over `${timestamp}.${rawBody}`, with a
 * timestamp freshness check to prevent replay. Used to authenticate
 * server-to-server callers (e.g. the Google Apps Script sync push) that have
 * no session/browser Origin to check against.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !timestampHeader || !secret) return false;

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() - timestamp) > MAX_CLOCK_SKEW_MS) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signatureHeader, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}
