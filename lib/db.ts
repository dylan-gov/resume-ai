import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Prisma 7 no longer reads a connection URL from schema.prisma — the client
 * takes a driver adapter instead.
 *
 * The client is constructed lazily, on first property access, so that
 * importing this module never requires DATABASE_URL. Next.js collects page
 * configuration at build time (and Vercel builds often have no database
 * credentials), so connecting eagerly would make the app unbuildable
 * without a live database.
 *
 * Server-only: importing this from a client component would pull
 * DATABASE_URL into the browser bundle.
 */
declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your Supabase Postgres instance."
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function getClient(): PrismaClient {
  // Reused across hot reloads in dev so we don't exhaust the connection pool.
  if (!globalThis.__prisma) globalThis.__prisma = createPrismaClient();
  return globalThis.__prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property, client);
    // Methods must keep their `this`, and model accessors return objects.
    return typeof value === "function" ? value.bind(client) : value;
  },
});
