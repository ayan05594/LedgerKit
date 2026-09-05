import { getPeopleBalances } from "@/server/queries";
import { createPerson } from "@/server/mutations";
import { handle } from "@/lib/api";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    return getPeopleBalances(userId);
  });
}

export async function POST(request: Request) {
  return handle(async () => ({ id: await createPerson(await request.json()) }));
}
