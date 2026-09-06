import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  try {
    const admin = createSupabaseAdminClient();
    const [
      categoryResult,
      instrumentResult,
      expenseResult,
      reimbursementResult,
      seedResult,
    ] =
      await Promise.all([
        admin.from("categories").select("id", { count: "exact", head: true }),
        admin.from("instruments").select("id", { count: "exact", head: true }),
        admin.from("expenses").select("id", { count: "exact", head: true }),
        admin
          .from("standalone_reimbursements")
          .select("id", { count: "exact", head: true }),
        admin.from("settings").select("key").eq("key", "seeded_at").limit(1),
      ]);
    const error =
      categoryResult.error ??
      instrumentResult.error ??
      expenseResult.error ??
      reimbursementResult.error ??
      seedResult.error;
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      region: process.env.VERCEL_REGION ?? "local",
      database: "connected",
      transport: "supabase-data-api",
      referenceReady: Boolean(seedResult.data?.length),
      counts: {
        categories: categoryResult.count ?? 0,
        cards: instrumentResult.count ?? 0,
        expenses: expenseResult.count ?? 0,
        standaloneReimbursements: reimbursementResult.count ?? 0,
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
