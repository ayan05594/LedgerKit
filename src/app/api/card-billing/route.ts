import { handleRead } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { getCardBilling } from "@/server/card-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return handleRead(async () => getCardBilling(await requireUserId()));
}
