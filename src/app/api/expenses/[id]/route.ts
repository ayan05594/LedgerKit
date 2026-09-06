import { getExpense } from "@/server/queries";
import { deleteExpense, updateExpense } from "@/server/mutations";
import { ApiError, handle, handleRead, fail, type Params } from "@/lib/api";
import { expenseSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  return handleRead(async () => {
    const row = await getExpense(id);
    if (!row) throw new ApiError("Expense not found", 404);
    return row;
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const parsed = expenseSchema.partial().safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid expense");
  return handle(async () => ({ id: await updateExpense(id, parsed.data) }));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  return handle(async () => ({ deleted: await deleteExpense(id) }));
}
