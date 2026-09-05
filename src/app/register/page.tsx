import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Register — LedgerKit" };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
