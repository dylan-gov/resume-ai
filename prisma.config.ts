import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

/**
 * Next.js reads `.env.local` but plain `dotenv/config` only reads `.env`,
 * so the Prisma CLI would not see DATABASE_URL/DIRECT_URL and would fail
 * with "datasource.url property is required". Load both, with `.env.local`
 * taking precedence, so `prisma migrate` uses exactly the same credentials
 * the app does.
 */
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    /**
     * Migrations need a session-mode connection. Supabase's direct host
     * (`db.<ref>.supabase.co`) is IPv6-only, so on an IPv4 network
     * DIRECT_URL should point at the session pooler (port 5432), not the
     * "Direct connection" string.
     */
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
