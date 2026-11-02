import { isProduction } from "@/lib/security/env";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export { getClientIp, rateLimit, rateLimitResponse };

const MAX_JSON_BYTES = 16 * 1024;

export async function parseJsonBody<T>(
  request: Request,
  maxBytes = MAX_JSON_BYTES,
): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    throw new Error("BODY_TOO_LARGE");
  }

  const text = await request.text();
  if (text.length > maxBytes) {
    throw new Error("BODY_TOO_LARGE");
  }

  return JSON.parse(text) as T;
}

/** Blocks cross-site mutation requests in production when Origin/Referer don't match the app host. */
export function assertSafeMutation(request: Request) {
  if (!isProduction()) return;

  const authUrl = process.env.AUTH_URL?.trim();
  if (!authUrl) return;

  let expectedHost: string;
  try {
    expectedHost = new URL(authUrl).host;
  } catch {
    return;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  const checkUrl = origin ?? referer;
  if (!checkUrl) {
    throw new Error("ORIGIN_REQUIRED");
  }

  try {
    if (new URL(checkUrl).host !== expectedHost) {
      throw new Error("ORIGIN_MISMATCH");
    }
  } catch {
    throw new Error("ORIGIN_INVALID");
  }
}

export function applyRateLimit(
  request: Request,
  namespace: string,
  limit: number,
  windowMs: number,
) {
  const ip = getClientIp(request);
  const result = rateLimit({
    key: `${namespace}:${ip}`,
    limit,
    windowMs,
  });

  if (!result.allowed) {
    return rateLimitResponse(result.retryAfterSec);
  }

  return null;
}
