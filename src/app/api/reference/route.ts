import { getReference } from "@/server/queries";
import { computeAccountBalances } from "@/server/mutations";
import { handleRead } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { db } from "@/db/client";
import { seedReference } from "@/db/seed";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let referenceReady = false;

async function ensureReferenceData() {
  if (referenceReady) return;
  const result = await createSupabaseAdminClient()
    .from("settings")
    .select("key")
    .eq("key", "seeded_at")
    .limit(1);
  if (result.error) throw result.error;
  const marker = result.data?.[0];
  if (!marker) await seedReference(db);
  referenceReady = true;
}

export async function GET() {
  return handleRead(async () => {
    const userId = await requireUserId();
    // Accounts created before the production migrations completed may have
    // missed the original registration-time seed. Repair that once, safely.
    await ensureReferenceData();
    const [reference, accountBalances] = await Promise.all([
      getReference(userId),
      computeAccountBalances(userId),
    ]);
    return { ...reference, accountBalances };
  });
}
