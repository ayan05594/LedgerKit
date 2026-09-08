import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(72),
  registrationSecret: z.string().min(1),
});

function sameSecret(left: string, right: string) {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail("Use a valid email and a password of at least 6 characters.", 400);
  }

  const expectedSecret = process.env.REGISTRATION_SECRET;
  if (!expectedSecret) {
    return fail("Registration is not configured. Contact the administrator.", 503);
  }
  if (!sameSecret(parsed.data.registrationSecret, expectedSecret)) {
    return fail("The registration secret is incorrect.", 403);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: { card_onboarding_completed: false },
  });
  if (error || !data.user) {
    const duplicate = error?.message.toLowerCase().includes("already");
    return fail(
      duplicate
        ? "An account with this email already exists."
        : "Could not create the account.",
      duplicate ? 409 : 400,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (signInError) {
    return ok({ redirectTo: "/login" });
  }

  return ok({ redirectTo: "/onboarding/cards" });
}
