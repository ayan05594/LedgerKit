import { getPending } from "@/server/queries";
import { handleRead } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRead(() => getPending());
}
