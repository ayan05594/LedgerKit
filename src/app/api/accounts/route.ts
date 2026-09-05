import { createAccount, computeAccountBalances } from "@/server/mutations";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => computeAccountBalances());
}

export async function POST(request: Request) {
  const body = await request.json();
  return handle(async () => ({ id: await createAccount(body) }));
}
