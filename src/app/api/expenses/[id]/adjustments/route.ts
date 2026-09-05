import { addAdjustment } from "@/server/mutations";
import { handle, fail, type Params } from "@/lib/api";
import { adjustmentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const parsed = adjustmentSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid adjustment");
  return handle(async () => ({ id: await addAdjustment(id, parsed.data) }));
}
