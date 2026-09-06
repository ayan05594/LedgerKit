import { getReference } from "@/server/queries";
import { computeAccountBalances } from "@/server/mutations";
import { handleRead } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { seedReference } from "@/db/seed";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let referenceReady = false;

async function ensureReferenceData() {
  if (referenceReady) return;
  const [marker] = await db
    .select({ key: settings.key })
    .from(settings)
    .where(eq(settings.key, "seeded_at"))
    .limit(1);
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
