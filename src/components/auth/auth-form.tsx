"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

type Mode = "login" | "register";

export function AuthForm({ mode, notice }: { mode: Mode; notice?: string }) {
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
      // Cross the authentication boundary with a full navigation so fresh
      // cookies and a new React Query cache are guaranteed for this user.
      window.location.assign(payload.data?.redirectTo ?? "/");
    } catch {
      setError("Could not reach LedgerKit. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#f2f3f6] p-3 sm:p-5 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-[1440px] overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_24px_80px_rgba(28,32,45,0.10)] sm:min-h-[calc(100dvh-2.5rem)] lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-[1.06fr_0.94fr] lg:rounded-[30px]">
        <BrandPanel />

        <section className="relative flex items-center justify-center px-5 py-8 sm:px-10 sm:py-12 lg:px-16">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rule-strong to-transparent lg:hidden" />
          <div className="w-full max-w-[440px]">
            <div className="mb-9 flex items-center justify-between lg:hidden">
              <BrandMark dark />
              <span className="rounded-full border border-rule bg-sunken/60 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-2">
                Private workspace
              </span>
            </div>

            <div className="mb-7">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent">
                {register ? <Sparkles className="size-3.5" /> : <LockKeyhole className="size-3.5" />}
                {register ? "Your ledger starts here" : "Secure sign in"}
              </div>
              <h1 className="text-[2rem] font-bold leading-[1.08] tracking-[-0.045em] text-ink sm:text-[2.35rem]">
                {register ? "Create your account" : "Welcome back"}
              </h1>
              <p className="mt-3 max-w-[390px] text-[0.9375rem] leading-6 text-ink-2">
                {register
                  ? "Use your email, choose a password, and enter your private registration secret."
                  : "Sign in to continue to your personal expense and rewards dashboard."}
              </p>
            </div>

            {notice && (
              <div
                role="status"
                className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-gain/15 bg-gain-soft px-3.5 py-3 text-sm leading-5 text-gain"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                {notice}
              </div>
            )}

            <form className="space-y-4" onSubmit={submit}>
              <Field label="Email address" htmlFor="auth-email">
                <input
                  id="auth-email"
                  name="email"
                  className="field h-12 bg-[#fbfbfc]"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </Field>

              <Field
                label="Password"
                htmlFor="auth-password"
                hint={register ? "6 characters minimum" : undefined}
              >
                <div className="relative">
                  <input
                    id="auth-password"
                    name="password"
                    className="field h-12 bg-[#fbfbfc] pr-12"
                    type={showPassword ? "text" : "password"}
                    autoComplete={register ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={register ? 6 : undefined}
                    placeholder={register ? "Choose a secure password" : "Enter your password"}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[9px] text-ink-3 transition-colors hover:text-ink"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-[1.1rem]" /> : <Eye className="size-[1.1rem]" />}
                  </button>
                </div>
              </Field>

              {register && (
                <>
                  <Field label="Confirm password" htmlFor="auth-confirm-password">
                    <input
                      id="auth-confirm-password"
                      name="confirmPassword"
                      className="field h-12 bg-[#fbfbfc]"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Enter it once more"
                      minLength={6}
                      required
                    />
                  </Field>
                  <Field
                    label="Registration secret"
                    htmlFor="auth-registration-secret"
                  >
                    <input
                      id="auth-registration-secret"
                      name="registrationSecret"
                      className="field h-12 bg-[#fbfbfc]"
                      type="password"
                      autoComplete="off"
                      value={registrationSecret}
                      onChange={(event) => setRegistrationSecret(event.target.value)}
                      placeholder="Enter your invitation secret"
                      required
                    />
                    <span className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
                      <ShieldCheck className="size-3.5 text-gain" />
                      Verified securely on the server
                    </span>
                  </Field>
                </>
              )}

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-[10px] border border-alert/10 bg-alert-soft px-3.5 py-3 text-sm leading-5 text-alert"
                >
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-alert" />
                  {error}
                </div>
              )}

              <button
                className="btn btn-primary group h-12 w-full justify-center rounded-[10px] text-[0.9375rem]"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    {register ? "Creating your account" : "Signing you in"}
                  </>
                ) : (
                  <>
                    {register ? "Create account" : "Sign in"}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-ink-2">
              {register ? "Already have an account?" : "New to LedgerKit?"}{" "}
              <Link
                className="font-semibold text-accent transition-colors hover:text-ink"
                href={register ? "/login" : "/register"}
              >
                {register ? "Sign in instead" : "Create an account"}
              </Link>
            </p>

            <div className="mt-9 flex items-center justify-center gap-2 text-xs text-ink-3">
              <ShieldCheck className="size-3.5" />
              Your financial records stay private to your account
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[#14171f] p-10 text-white lg:flex lg:flex-col xl:p-14">
      <div className="absolute -left-32 top-1/3 size-[420px] rounded-full bg-[#3742a5]/30 blur-[110px]" />
      <div className="absolute -right-32 -top-32 size-[430px] rounded-full bg-[#25a47a]/20 blur-[120px]" />
      <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative z-10">
        <BrandMark />
      </div>

      <div className="relative z-10 my-auto py-12">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/75">
          <Sparkles className="size-3.5 text-[#91d8bd]" />
          Money clarity, without the clutter
        </div>
        <h2 className="max-w-[560px] text-[2.8rem] font-semibold leading-[1.05] tracking-[-0.055em] xl:text-[3.6rem]">
          Every expense.
          <br />
          Every reward.
          <br />
          <span className="text-white/45">One clear view.</span>
        </h2>
        <p className="mt-5 max-w-[500px] text-[0.9375rem] leading-6 text-white/55">
          Understand where your money goes and what your cards actually earn,
          after caps, refunds, and reimbursements.
        </p>

        <div className="mt-10 max-w-[540px] rounded-[22px] border border-white/10 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-sm xl:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-white/40">
                Monthly overview
              </p>
              <p className="mt-1 text-[1.75rem] font-semibold tracking-[-0.04em]">
                ₹84,260
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#91d8bd]/15 text-[#91d8bd]">
              <BarChart3 className="size-5" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2.5">
            <Metric icon={ReceiptText} label="Transactions" value="47" />
            <Metric icon={Wallet} label="Rewards" value="₹2,940" />
            <Metric icon={CheckCircle2} label="Tracked" value="100%" />
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-5 text-xs text-white/40">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" /> Private by default
        </span>
        <span className="size-1 rounded-full bg-white/20" />
        <span>Built for real-world spending</span>
      </div>
    </aside>
  );
}

function BrandMark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex size-10 items-center justify-center rounded-xl ${
          dark ? "bg-ink text-white" : "bg-white text-[#14171f]"
        }`}
      >
        <Wallet className="size-5" aria-hidden />
      </span>
      <div className="leading-tight">
        <div className={`text-lg font-bold tracking-[-0.035em] ${dark ? "text-ink" : "text-white"}`}>
          LedgerKit
        </div>
        <div className={`text-[0.65rem] font-medium tracking-[0.08em] ${dark ? "text-ink-3" : "text-white/40"}`}>
          SPEND SMARTER
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3">
      <Icon className="mb-3 size-4 text-white/35" />
      <p className="text-[0.62rem] text-white/35">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white/90">{value}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <div className="mb-1.5 flex items-center justify-between text-[0.8125rem] font-semibold text-ink">
        <label htmlFor={htmlFor}>{label}</label>
        {hint && <span className="font-normal text-ink-3">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
