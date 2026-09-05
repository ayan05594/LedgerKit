import { createRule } from "@/server/mutations";
import { handle, type Params } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  return handle(async () => ({ id: await createRule(id, body) }));
}
