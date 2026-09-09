import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "./config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(values) {
        for (const { name, value, options } of values) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

/** Clear every chunk of this project's SSR auth cookie. This is used only
 * after a wallet was committed but an already-damaged refresh token could not
 * be rotated; the next password sign-in repairs metadata from durable state. */
export async function clearSupabaseAuthCookies() {
  const cookieStore = await cookies();
  const projectRef = new URL(supabaseUrl()).hostname.split(".")[0];
  const authCookiePrefix = `sb-${projectRef}-auth-token`;
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith(authCookiePrefix)) {
      cookieStore.delete(cookie.name);
    }
  }
}
