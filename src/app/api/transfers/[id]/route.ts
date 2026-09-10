import { deleteTransfer, updateTransfer } from "@/server/mutations";
import { fail, handle, type Params } from "@/lib/api";
import { transferSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const parsed = transferSchema.partial().safeParse(await request.json());
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid transfer");
  }
  return handle(async () => ({ updated: await updateTransfer(id, parsed.data) }));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  return handle(async () => ({ deleted: await deleteTransfer(id) }));
}
