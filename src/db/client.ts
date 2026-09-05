import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Add the Supabase Postgres connection string to your local .env.local and Vercel project settings.",
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
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__ledgerkitSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
