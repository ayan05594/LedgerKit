import { listExpenses } from "@/server/queries";
import { createExpense } from "@/server/mutations";
import { handle, fail } from "@/lib/api";
import { expenseSchema } from "@/lib/validation";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const get = (k: string) => p.get(k) || undefined;
  return handle(async () => {
    const userId = await requireUserId();
    return listExpenses({
      from: get("from"),
      to: get("to"),
      instrumentId: get("instrumentId"),
      accountId: get("accountId"),
      categorySlug: get("categorySlug"),
      appSlug: get("appSlug"),
      search: get("search"),
      reimbursableOnly: p.get("reimbursableOnly") === "1",
      hasRefund: p.get("hasRefund") === "1",
      limit: p.get("limit") ? Number(p.get("limit")) : undefined,
    }, userId);
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid expense");
  return handle(async () => ({ id: await createExpense(parsed.data) }));
}
