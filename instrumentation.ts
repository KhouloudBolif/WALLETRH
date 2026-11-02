export async function register() {
  const { assertSecureEnvironment } = await import("@/lib/security/env");
  assertSecureEnvironment();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Some networks resolve script.google.com's IPv6 record to an address
    // that silently black-holes outbound connections from Node's fetch
    // (undici) — curl on the same machine works fine, since it falls back to
    // IPv4 faster. This forces IPv4 first for all outbound fetches (used by
    // the ZIP-export bridge calling out to Apps Script), rather than
    // requiring every environment to remember a NODE_OPTIONS flag.
    const { setDefaultResultOrder } = await import("node:dns");
    setDefaultResultOrder("ipv4first");
  }
}
