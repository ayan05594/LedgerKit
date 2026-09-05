import { listTransfers } from "@/server/queries";
import { createTransfer } from "@/server/mutations";
import { handle, fail } from "@/lib/api";
import { transferSchema } from "@/lib/validation";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    return listTransfers(200, userId);
  });
}

export async function POST(request: Request) {
  const parsed = transferSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid transfer");
  return handle(async () => ({ id: await createTransfer(parsed.data) }));
}
