import { getMonthSummary } from "@/server/queries";
import { computeAccountBalances } from "@/server/mutations";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const now = new Date();
  const year = Number(url.searchParams.get("year") ?? now.getFullYear());
  const month = Number(url.searchParams.get("month") ?? now.getMonth() + 1);
  return handle(async () => ({
    summary: await getMonthSummary(year, month),
    accountBalances: await computeAccountBalances(),
  }));
}
