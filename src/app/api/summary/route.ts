import { getMonthSummary } from "@/server/queries";
import { computeAccountBalances } from "@/server/mutations";
import { handle } from "@/lib/api";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const now = new Date();
  const year = Number(url.searchParams.get("year") ?? now.getFullYear());
  const month = Number(url.searchParams.get("month") ?? now.getMonth() + 1);
  return handle(async () => {
    const userId = await requireUserId();
    const [summary, accountBalances] = await Promise.all([
      getMonthSummary(year, month, userId),
      computeAccountBalances(userId),
    ]);
    return { summary, accountBalances };
  });
}
