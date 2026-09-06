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
// prepared statements. Vercel can freeze a warm function while its TCP sockets
// quietly expire, so the client below can be replaced before a resumed read.
function createSqlClient() {
  return postgres(databaseUrl!, {
    prepare: false,
    // Keep the remaining write/query path small while allowing a second
    // connection when one pooler socket is slow to establish.
    max: 2,
    idle_timeout: 5,
    connect_timeout: 3,
    max_lifetime: 30,
    keep_alive: 5,
  });
}

const globalForDb = globalThis as unknown as {
  __ledgerkitSql?: ReturnType<typeof postgres>;
};

export let sql = globalForDb.__ledgerkitSql ?? createSqlClient();
export let db = drizzle(sql, { schema });

if (process.env.NODE_ENV !== "production") globalForDb.__ledgerkitSql = sql;

let lastDatabaseReadAt = Date.now();
let recyclePromise: Promise<void> | null = null;

async function replaceDatabaseClient() {
  const staleSql = sql;
  sql = createSqlClient();
  db = drizzle(sql, { schema });
  if (process.env.NODE_ENV !== "production") globalForDb.__ledgerkitSql = sql;
  await staleSql.end({ timeout: 0 }).catch(() => undefined);
}

// Recycle sockets after an idle/frozen period so a query is never handed to a
// connection that Supabase's pooler has already expired.
export async function prepareDatabaseRead(force = false) {
  const now = Date.now();
  const resumedAfterIdle = now - lastDatabaseReadAt > 15_000;
  lastDatabaseReadAt = now;

  if (recyclePromise) return recyclePromise;
  if (!force && !resumedAfterIdle) return;

  recyclePromise = replaceDatabaseClient().finally(() => {
    recyclePromise = null;
  });
  return recyclePromise;
}
export { schema };
