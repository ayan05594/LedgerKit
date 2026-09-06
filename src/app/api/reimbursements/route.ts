import {
  createStandaloneReimbursement,
} from "@/server/mutations";
import { listStandaloneReimbursements } from "@/server/queries";
import { ApiError, handle, handleRead } from "@/lib/api";
import { standaloneReimbursementSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRead(() => listStandaloneReimbursements());
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json().catch(() => {
      throw new ApiError("Request body must be valid JSON.", 400);
    });
    const parsed = standaloneReimbursementSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "Invalid reimbursement.",
        400,
      );
    }
    return { id: await createStandaloneReimbursement(parsed.data) };
  });
}
