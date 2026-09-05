import { deleteRefund, updateRefund } from "@/server/mutations";
import { handle, fail, type Params } from "@/lib/api";
import { refundSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const parsed = refundSchema.partial().safeParse(await request.json());
  if (!parsed.success) return fail("Invalid refund");
  return handle(async () => ({ updated: await updateRefund(id, parsed.data) }));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  return handle(async () => ({ deleted: await deleteRefund(id) }));
}
