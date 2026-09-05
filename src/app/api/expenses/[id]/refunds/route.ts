import { addRefund } from "@/server/mutations";
import { handle, fail, type Params } from "@/lib/api";
import { refundSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const parsed = refundSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid refund");
  return handle(async () => ({ id: await addRefund(id, parsed.data) }));
}
