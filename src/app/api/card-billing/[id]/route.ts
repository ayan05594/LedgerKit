import { z } from "zod";
import { ApiError, handle, type Params } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { updateCardBillingConfig } from "@/server/card-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  statementDay: z.number().int().min(1).max(31),
  dueOffsetDays: z.number().int().min(1).max(45),
  repaymentAccountId: z.string().trim().min(1).nullable(),
  openingOutstandingPaise: z.number().int().min(0).max(1_000_000_000_00),
  openingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  autopayMode: z.enum(["none", "full", "minimum", "fixed"]),
  autopayAmountPaise: z.number().int().min(0).max(1_000_000_000_00),
}).superRefine((value, context) => {
  if (value.autopayMode === "fixed" && value.autopayAmountPaise <= 0) {
    context.addIssue({
      code: "custom",
      path: ["autopayAmountPaise"],
      message: "Enter the fixed autopay amount.",
    });
  }
});

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid billing settings.", 400);
    }
    const { id } = await params;
    return { id: await updateCardBillingConfig(await requireUserId(), id, parsed.data) };
  });
}
