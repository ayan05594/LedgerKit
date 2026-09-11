import { z } from "zod";
import { ApiError, handle, type Params } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { deleteCardPayment, updateCardPayment } from "@/server/card-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  accountId: z.string().trim().min(1).nullable(),
  amountPaise: z.number().int().positive().max(1_000_000_000_00),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(300).default(""),
});

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid card payment.", 400);
    }
    const { id } = await params;
    return { id: await updateCardPayment(await requireUserId(), id, parsed.data) };
  });
}

export async function DELETE(_: Request, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    return { id: await deleteCardPayment(await requireUserId(), id) };
  });
}
