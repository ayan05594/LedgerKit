import { getExpense } from "@/server/queries";
import { deleteExpense, updateExpense } from "@/server/mutations";
import { ApiError, handle, handleRead, type Params } from "@/lib/api";
import { expenseEditSchema } from "@/lib/validation";

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
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => {
      throw new ApiError("Request body must be valid JSON.", 400);
    });
    const parsed = expenseEditSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "Invalid expense",
        400,
      );
    }
    const updatedId = await updateExpense(id, parsed.data);
    if (!updatedId) throw new ApiError("Expense not found", 404);
    return { id: updatedId };
  });
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  return handle(async () => ({ deleted: await deleteExpense(id) }));
}
