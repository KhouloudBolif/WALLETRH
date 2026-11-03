import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaClientVersion?: string;
};

/** Bump when adding Prisma models so hot-reload doesn't keep a stale singleton. */
const PRISMA_CLIENT_VERSION = "user-last-login-v1";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function hasModel(
  client: PrismaClient,
  name: "employeeInformation" | "savedQuery" | "downloadLog",
): boolean {
  const delegate = (client as unknown as Record<string, { findMany?: unknown } | undefined>)[name];
  return typeof delegate?.findMany === "function";
}

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (
    cached &&
    globalForPrisma.prismaClientVersion === PRISMA_CLIENT_VERSION &&
    hasModel(cached, "employeeInformation") &&
    hasModel(cached, "savedQuery") &&
    hasModel(cached, "downloadLog")
  ) {
    return cached;
  }

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaClientVersion = PRISMA_CLIENT_VERSION;
  }
  return client;
}

/**
 * Lazy proxy: après un `prisma generate`, HMR peut garder un `export const`
 * figé sans le nouveau modèle — chaque accès repasse par getPrismaClient().
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
