import { fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  return fail("Verified catalogue reward rules are read-only.", 403);
}
