import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/ledgerkit",
  },
  strict: true,
  verbose: true,
} satisfies Config;
