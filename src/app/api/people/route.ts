import { getPeopleBalances } from "@/server/queries";
import { createPerson } from "@/server/mutations";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => getPeopleBalances());
}

export async function POST(request: Request) {
  return handle(async () => ({ id: await createPerson(await request.json()) }));
}
