import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// Vercel's Supabase integration provides POSTGRES_URL with the correct pooled
// host and encoded credentials. Prefer it in production; DATABASE_URL remains
// the convenient local/CLI fallback.
const databaseUrl =
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL;

if (!databaseUrl) {
  throw new Error(
    "No Postgres connection URL is configured. Add POSTGRES_URL or DATABASE_URL.",
  );
}

// Supabase's transaction pooler and serverless functions work best without
// prepared statements. Reuse the client while a Vercel instance stays warm.
const globalForDb = globalThis as unknown as {
  __ledgerkitSql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForDb.__ledgerkitSql ??
  postgres(databaseUrl, {
    prepare: false,
    // Summary screens intentionally run independent reads in parallel. A tiny
    // pool avoids serialising dozens of round trips behind one connection.
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__ledgerkitSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
