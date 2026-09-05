import { createMerchant } from "@/server/mutations";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => ({ id: await createMerchant(await request.json()) }));
}
