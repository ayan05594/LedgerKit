import "server-only";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AuthenticationError extends Error {
  constructor(message = "Please sign in to continue.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export async function requireUserId() {
  // Middleware has already verified this value and overwrites any same-named
  // browser header. Reusing it avoids a second Supabase Auth request for every
  // API read immediately after login.
  const verifiedByMiddleware = (await headers()).get("x-ledgerkit-user-id");
  if (verifiedByMiddleware) return verifiedByMiddleware;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (error || !userId) throw new AuthenticationError();
  return userId;
}
