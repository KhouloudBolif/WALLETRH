type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

/** In-memory rate limiter (per server instance). Use Redis for multi-instance production. */
export function rateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const bucket = store.get(options.key);

  if (!bucket || now >= bucket.resetAt) {
    store.set(options.key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return { allowed: true };
  }

  if (bucket.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimitResponse(retryAfterSec?: number) {
  return new Response(
    JSON.stringify({
      error: "Trop de tentatives. Réessayez plus tard.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...(retryAfterSec
          ? { "Retry-After": String(retryAfterSec) }
          : {}),
      },
    },
  );
}
