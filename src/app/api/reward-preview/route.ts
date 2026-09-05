import { previewReward } from "@/lib/rewards/recompute";
import { handle, fail } from "@/lib/api";
import { previewSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = previewSchema.safeParse(await request.json());
  if (!parsed.success) return fail("Not enough detail to preview a reward");
  return handle(() => previewReward(parsed.data));
}
