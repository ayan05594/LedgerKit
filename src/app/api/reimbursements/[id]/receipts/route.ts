import { recordStandaloneReimbursementReceipt } from "@/server/mutations";
import { ApiError, handle, type Params } from "@/lib/api";
import { standaloneReimbursementReceiptSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => {
      throw new ApiError("Request body must be valid JSON.", 400);
    });
    const parsed = standaloneReimbursementReceiptSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "Invalid reimbursement payment.",
        400,
      );
    }
    return {
      id: await recordStandaloneReimbursementReceipt(id, parsed.data),
    };
  });
}
