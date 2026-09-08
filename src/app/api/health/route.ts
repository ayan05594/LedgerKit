import { NextResponse } from "next/server";
import { CREDIT_CARD_CATALOG_VERSION } from "@/data/credit-card-seed";
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
      seedResult,
      catalogVersionResult,
      cardSelectionResult,
      accountOwnershipResult,
      taxonomyOwnershipResult,
      instrumentOwnershipResult,
    ] =
      await Promise.all([
        admin
          .from("categories")
          .select("id", { count: "exact", head: true })
          .eq("is_system", true),
        admin
          .from("instruments")
          .select("id", { count: "exact", head: true })
          .eq("is_catalog_card", true)
          .eq("archived", false),
        admin.from("settings").select("key").eq("key", "seeded_at").limit(1),
        admin
          .from("settings")
          .select("value")
          .eq("key", "credit_card_catalog_version")
          .maybeSingle(),
        admin.from("user_card_selections").select("user_id", { head: true }),
        admin.from("accounts").select("user_id", { head: true }),
        admin.from("categories").select("owner_user_id", { head: true }),
        admin.from("instruments").select("owner_user_id", { head: true }),
      ]);
    const error =
      categoryResult.error ??
      instrumentResult.error ??
      seedResult.error ??
      catalogVersionResult.error ??
      cardSelectionResult.error ??
      accountOwnershipResult.error ??
      taxonomyOwnershipResult.error ??
      instrumentOwnershipResult.error;
    if (error) throw error;

    const catalogReady =
      catalogVersionResult.data?.value === CREDIT_CARD_CATALOG_VERSION &&
      (instrumentResult.count ?? 0) > 0;

    return NextResponse.json({
      ok: true,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      region: process.env.VERCEL_REGION ?? "local",
      database: "connected",
      transport: "supabase-data-api",
      referenceReady: Boolean(seedResult.data?.length),
      catalogReady,
      cardSelectionReady: !cardSelectionResult.error,
      manualCardReady: !instrumentOwnershipResult.error,
      ownershipReady:
        !accountOwnershipResult.error &&
        !taxonomyOwnershipResult.error &&
        !instrumentOwnershipResult.error,
      catalogVersion: catalogVersionResult.data?.value ?? null,
      counts: {
        categories: categoryResult.count ?? 0,
        catalogCards: instrumentResult.count ?? 0,
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
