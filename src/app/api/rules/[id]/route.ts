import { deleteRule, updateRule } from "@/server/mutations";
import { handle, type Params } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  return handle(async () => ({ updated: await updateRule(id, body) }));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  return handle(async () => ({ deleted: await deleteRule(id) }));
}
