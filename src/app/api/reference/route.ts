import { getReference } from "@/server/queries";
import { computeAccountBalances } from "@/server/mutations";
import { handle } from "@/lib/api";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    const [reference, accountBalances] = await Promise.all([
      getReference(),
      computeAccountBalances(userId),
    ]);
    return { ...reference, accountBalances };
  });
}
