import { loadDemoData } from "@/server/demo";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  return handle(() => loadDemoData());
}
