import { fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  return fail("Sample data is not available in production.", 404);
}
