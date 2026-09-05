import { clearTransactions } from "@/server/mutations";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  return handle(async () => ({ cleared: await clearTransactions() }));
}
