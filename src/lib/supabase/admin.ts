import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdminKey, supabaseUrl } from "./config";

export function createSupabaseAdminClient() {
  return createClient(supabaseUrl(), supabaseAdminKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
