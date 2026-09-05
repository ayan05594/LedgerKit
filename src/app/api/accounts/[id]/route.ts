import { deleteAccount, updateAccount } from "@/server/mutations";
import { handle, type Params } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return handle(async () => ({ updated: await updateAccount(id, await request.json()) }));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  return handle(async () => ({ deleted: await deleteAccount(id) }));
}
