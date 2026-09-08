import { getReference } from "@/server/queries";
import { computeAccountBalances } from "@/server/mutations";
import { handleRead } from "@/lib/api";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return handleRead(async () => {
    const userId = await requireUserId();
    const [reference, accountBalances] = await Promise.all([
      getReference(userId),
      computeAccountBalances(userId),
    ]);
    return { ...reference, accountBalances };
  });
}
