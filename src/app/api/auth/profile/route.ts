import { AuthenticationError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function nameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const words = localPart
    .replace(/[0-9]+$/g, "")
    .split(/[._-]+/)
    .filter(Boolean);

  if (words.length === 0) return "LedgerKit user";
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function GET() {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    const email = typeof claims?.email === "string" ? claims.email : "";

    if (error || !claims?.sub || !email) throw new AuthenticationError();

    const metadata =
      claims.user_metadata && typeof claims.user_metadata === "object"
        ? (claims.user_metadata as Record<string, unknown>)
        : {};
    const metadataName = [metadata.full_name, metadata.display_name, metadata.name]
      .find(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
      ?.trim();

    return {
      name: metadataName ?? nameFromEmail(email),
      email,
    };
  });
}
