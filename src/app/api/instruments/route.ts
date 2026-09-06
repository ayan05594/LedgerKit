import type { Instrument, RewardRule } from "@/db/schema";
import { createInstrument } from "@/server/mutations";
import { handle, handleRead } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fromSupabaseRows } from "@/lib/supabase/rows";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRead(async () => {
    const admin = createSupabaseAdminClient();
    const [instrumentResult, ruleResult] = await Promise.all([
      admin.from("instruments").select("*").eq("archived", false).order("sort_order"),
      admin.from("reward_rules").select("*").order("priority", { ascending: false }),
    ]);
    if (instrumentResult.error) throw instrumentResult.error;
    if (ruleResult.error) throw ruleResult.error;
    const instrumentRows = fromSupabaseRows<Instrument>(instrumentResult.data);
    const rules = fromSupabaseRows<RewardRule>(ruleResult.data);
    return instrumentRows.map((instrument) => ({
      instrument,
      rules: rules.filter((r) => r.instrumentId === instrument.id),
    }));
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return handle(async () => ({ id: await createInstrument(body) }));
}
