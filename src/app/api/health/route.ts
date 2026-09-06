import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { categories, expenses, instruments, settings } from "@/db/schema";
import { runDatabaseRead } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  try {
    const [[categoryCount], [instrumentCount], [expenseCount], [seedMarker]] =
      await runDatabaseRead(() =>
        Promise.all([
          db.select({ value: count() }).from(categories),
          db.select({ value: count() }).from(instruments),
          db.select({ value: count() }).from(expenses),
          db
            .select({ key: settings.key })
            .from(settings)
            .where(eq(settings.key, "seeded_at"))
            .limit(1),
        ]),
      );

    return NextResponse.json({
      ok: true,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      region: process.env.VERCEL_REGION ?? "local",
      database: "connected",
      referenceReady: Boolean(seedMarker),
      counts: {
        categories: categoryCount?.value ?? 0,
        cards: instrumentCount?.value ?? 0,
        expenses: expenseCount?.value ?? 0,
      },
      responseTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("Database health check failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown database error",
    });
    return NextResponse.json(
      {
        ok: false,
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
        region: process.env.VERCEL_REGION ?? "local",
        database: "unavailable",
        responseTimeMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
