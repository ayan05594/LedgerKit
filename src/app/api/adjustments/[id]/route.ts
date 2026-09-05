import { deleteAdjustment, updateAdjustment } from "@/server/mutations";
import { handle, fail, type Params } from "@/lib/api";
import { adjustmentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const parsed = adjustmentSchema.partial().safeParse(await request.json());
  if (!parsed.success) return fail("Invalid adjustment");
  return handle(async () => ({ updated: await updateAdjustment(id, parsed.data) }));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  return handle(async () => ({ deleted: await deleteAdjustment(id) }));
}
