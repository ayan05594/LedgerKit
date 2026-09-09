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
      sliceCardResult,
      sliceRuleResult,
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
        admin
          .from("instruments")
          .select("id,name,reward_coverage,reward_kind,unit_value_paise")
          .eq("id", "card-slice-rupay")
          .eq("is_catalog_card", true)
          .eq("availability", "active")
          .maybeSingle(),
        admin
          .from("reward_rules")
          .select("id,rate_type,block_size_paise,points_per_block")
          .eq("id", "slice-base")
          .eq("instrument_id", "card-slice-rupay")
          .eq("active", true)
          .maybeSingle(),
      ]);
    const error =
      categoryResult.error ??
      instrumentResult.error ??
      seedResult.error ??
      catalogVersionResult.error ??
      cardSelectionResult.error ??
      accountOwnershipResult.error ??
      taxonomyOwnershipResult.error ??
      instrumentOwnershipResult.error ??
      sliceCardResult.error ??
      sliceRuleResult.error;
    if (error) throw error;

    const catalogReady =
      catalogVersionResult.data?.value === CREDIT_CARD_CATALOG_VERSION &&
      (instrumentResult.count ?? 0) > 0;
    const referenceReady = Boolean(seedResult.data?.length);
    const cardSelectionReady = !cardSelectionResult.error;
    const manualCardReady = !instrumentOwnershipResult.error;
    const sliceCardReady =
      sliceCardResult.data?.id === "card-slice-rupay" &&
      sliceCardResult.data?.name === "slice UPI Credit Card" &&
      sliceCardResult.data?.reward_coverage === "partial" &&
      sliceCardResult.data?.reward_kind === "points" &&
      sliceCardResult.data?.unit_value_paise === 1;
    const sliceRewardsReady =
      sliceRuleResult.data?.id === "slice-base" &&
      sliceRuleResult.data?.rate_type === "points_per_block" &&
      sliceRuleResult.data?.block_size_paise === 100 &&
      sliceRuleResult.data?.points_per_block === 1;
    const ownershipReady =
      !accountOwnershipResult.error &&
      !taxonomyOwnershipResult.error &&
      !instrumentOwnershipResult.error;
    const ok =
      referenceReady &&
      catalogReady &&
      cardSelectionReady &&
      manualCardReady &&
      sliceCardReady &&
      sliceRewardsReady &&
      ownershipReady;

    return NextResponse.json(
      {
        ok,
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
        region: process.env.VERCEL_REGION ?? "local",
        database: "connected",
        transport: "supabase-data-api",
        referenceReady,
        catalogReady,
        cardSelectionReady,
        manualCardReady,
        sliceCardReady,
        sliceRewardsReady,
        ownershipReady,
        catalogVersion: catalogVersionResult.data?.value ?? null,
        counts: {
          categories: categoryResult.count ?? 0,
          catalogCards: instrumentResult.count ?? 0,
        },
        responseTimeMs: Date.now() - startedAt,
      },
      { status: ok ? 200 : 503 },
    );
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
