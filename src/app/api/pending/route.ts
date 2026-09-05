import { getPending } from "@/server/queries";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => getPending());
}
