import { createCategory, updateCategory } from "@/server/mutations";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => ({ id: await createCategory(await request.json()) }));
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { id: string } & Record<string, unknown>;
  return handle(async () => ({ updated: await updateCategory(body.id, body) }));
}
