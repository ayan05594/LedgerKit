import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign in — LedgerKit" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ walletSaved?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthForm
      mode="login"
      notice={
        params.walletSaved === "1"
          ? "Your card choices are saved. Sign in once more to refresh your secure session."
          : undefined
      }
    />
  );
}
