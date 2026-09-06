import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { instruments, rewardRules } from "@/db/schema";
import { createInstrument } from "@/server/mutations";
import { handle, handleRead } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRead(async () => {
    const [instrumentRows, rules] = await Promise.all([
      db
        .select()
        .from(instruments)
        .where(eq(instruments.archived, false))
        .orderBy(asc(instruments.sortOrder)),
      db
        .select()
        .from(rewardRules)
        .orderBy(desc(rewardRules.priority)),
    ]);
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
