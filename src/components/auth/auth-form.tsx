"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Wallet } from "lucide-react";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [registrationSecret, setRegistrationSecret] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const register = mode === "register";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (register && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(register ? { registrationSecret } : {}),
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: { redirectTo?: string };
      };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Something went wrong.");
        return;
      }
      router.replace(payload.data?.redirectTo ?? "/");
      router.refresh();
    } catch {
      setError("Could not reach LedgerKit. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <section className="w-full max-w-[430px]">
        <div className="mb-7 flex items-center justify-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-ink">
            <Wallet className="size-5 text-white" aria-hidden />
          </span>
          <span className="text-xl font-bold tracking-[-0.03em]">LedgerKit</span>
        </div>

        <div className="panel p-6 sm:p-8">
          <div className="mb-6">
            <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <LockKeyhole className="size-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-[-0.035em]">
              {register ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
              {register
                ? "Register with your email, a password, and the private registration secret."
                : "Sign in to see your own expenses and rewards."}
            </p>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            <Field label="Email">
              <input
                className="input w-full"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </Field>

            <Field label="Password">
              <div className="relative">
                <input
                  className="input w-full pr-11"
                  type={showPassword ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={register ? 6 : undefined}
                  placeholder={register ? "At least 6 characters" : "Your password"}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-3 hover:text-ink"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            {register && (
              <>
                <Field label="Confirm password">
                  <input
                    className="input w-full"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={6}
                    required
                  />
                </Field>
                <Field label="Registration secret">
                  <input
                    className="input w-full"
                    type="password"
                    autoComplete="off"
                    value={registrationSecret}
                    onChange={(event) => setRegistrationSecret(event.target.value)}
                    placeholder="Enter the private secret"
                    required
                  />
                </Field>
              </>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-alert-soft px-3 py-2.5 text-sm text-alert">
                {error}
              </p>
            )}

            <button className="btn btn-primary w-full justify-center" disabled={submitting}>
              {submitting
                ? register
                  ? "Creating account…"
                  : "Signing in…"
                : register
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-2">
            {register ? "Already registered?" : "Need an account?"}{" "}
            <Link
              className="font-semibold text-ink underline decoration-rule-strong underline-offset-4"
              href={register ? "/login" : "/register"}
            >
              {register ? "Sign in" : "Register"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
