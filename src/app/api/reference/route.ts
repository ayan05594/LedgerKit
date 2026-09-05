import { getReference } from "@/server/queries";
import { computeAccountBalances } from "@/server/mutations";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => ({
    ...(await getReference()),
    accountBalances: await computeAccountBalances(),
  }));
}
