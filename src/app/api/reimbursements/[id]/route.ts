import {
  deleteStandaloneReimbursement,
  updateStandaloneReimbursement,
} from "@/server/mutations";
import { getStandaloneReimbursement } from "@/server/queries";
import { ApiError, handle, handleRead, type Params } from "@/lib/api";
import { standaloneReimbursementSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const standaloneReimbursementUpdateSchema =
  standaloneReimbursementSchema.partial();

export async function GET(_: Request, { params }: Params) {
  return handleRead(async () => {
    const { id } = await params;
    const row = await getStandaloneReimbursement(id);
    if (!row) throw new ApiError("Reimbursement not found.", 404);
    return row;
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => {
      throw new ApiError("Request body must be valid JSON.", 400);
    });
    const parsed = standaloneReimbursementUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "Invalid reimbursement.",
        400,
      );
    }
    if (Object.keys(parsed.data).length === 0) {
      throw new ApiError("Provide at least one field to update.", 400);
    }
    const updatedId = await updateStandaloneReimbursement(id, parsed.data);
    if (!updatedId) throw new ApiError("Reimbursement not found.", 404);
    return { id: updatedId };
  });
}

export async function DELETE(_: Request, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const deleted = await deleteStandaloneReimbursement(id);
    if (!deleted) throw new ApiError("Reimbursement not found.", 404);
    return { deleted: true };
  });
}
