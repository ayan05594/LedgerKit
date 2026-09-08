import type { RewardRule } from "@/db/schema";
import { fail, handleRead } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fromSupabaseRows } from "@/lib/supabase/rows";
import { rewardAutomationEnabled } from "@/lib/rewards/coverage";
import { requireUserId } from "@/lib/auth";
import { listSelectedInstruments } from "@/server/card-selection";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRead(async () => {
    const userId = await requireUserId();
    const admin = createSupabaseAdminClient();
    const instrumentRows = await listSelectedInstruments(userId);
    if (!instrumentRows.length) return [];
    const automatedIds = instrumentRows
      .filter(rewardAutomationEnabled)
      .map(({ id }) => id);
    let rules: RewardRule[] = [];
    if (automatedIds.length) {
      const ruleResult = await admin
        .from("reward_rules")
        .select("*")
        .in("instrument_id", automatedIds)
        .order("priority", { ascending: false });
      if (ruleResult.error) throw ruleResult.error;
      rules = fromSupabaseRows<RewardRule>(ruleResult.data);
    }
    return instrumentRows.map((instrument) => ({
      instrument,
      rules: rules.filter((r) => r.instrumentId === instrument.id),
    }));
  });
}

export async function POST() {
  return fail(
    "Official catalogue cards are managed through verified issuer updates.",
    403,
  );
}
