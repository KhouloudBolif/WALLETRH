const MIN_AUTH_SECRET_LENGTH = 32;

export function assertSecureEnvironment() {
  const secret = process.env.AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "[security] AUTH_SECRET is missing. Set a random string (32+ chars) in .env",
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    secret.length < MIN_AUTH_SECRET_LENGTH
  ) {
    throw new Error(
      `[security] AUTH_SECRET must be at least ${MIN_AUTH_SECRET_LENGTH} characters in production`,
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    (secret.includes("dev-secret") || secret.includes("change-in-production"))
  ) {
    throw new Error("[security] AUTH_SECRET must not be a placeholder in production");
  }
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
