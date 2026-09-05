import { createPaymentApp } from "@/server/mutations";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => ({ id: await createPaymentApp(await request.json()) }));
}
