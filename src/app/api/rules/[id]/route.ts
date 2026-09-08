import { fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH() {
  return fail("Verified catalogue reward rules are read-only.", 403);
}

export async function DELETE() {
  return fail("Verified catalogue reward rules are read-only.", 403);
}
