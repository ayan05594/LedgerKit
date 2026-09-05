import { listTransfers } from "@/server/queries";
import { createTransfer } from "@/server/mutations";
import { handle, fail } from "@/lib/api";
import { transferSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => listTransfers());
}

export async function POST(request: Request) {
  const parsed = transferSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid transfer");
  return handle(async () => ({ id: await createTransfer(parsed.data) }));
}
