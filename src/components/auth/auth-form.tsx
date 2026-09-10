"use client";

import * as React from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

const ease = [0.22, 1, 0.36, 1] as const;

export function AuthForm({ mode, notice }: { mode: Mode; notice?: string }) {
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [registrationSecret, setRegistrationSecret] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showSecret, setShowSecret] = React.useState(false);
  const [capsLock, setCapsLock] = React.useState(false);
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const register = mode === "register";
  const passwordScore = getPasswordScore(password);
  const passwordMatch =
    register && confirmPassword.length > 0 && password === confirmPassword;

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
      window.location.assign(payload.data?.redirectTo ?? "/");
    } catch {
      setError("Could not reach LedgerKit. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function detectCapsLock(event: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#f1f3f9] p-2 sm:p-4 lg:p-5">
      <BackgroundGlow reduceMotion={Boolean(reduceMotion)} />

      <div className="relative mx-auto grid min-h-[calc(100dvh-1rem)] max-w-[1480px] overflow-hidden rounded-[24px] border border-white/90 bg-white/90 shadow-[0_30px_100px_rgba(25,31,52,0.14)] backdrop-blur-xl sm:min-h-[calc(100dvh-2rem)] sm:rounded-[30px] lg:min-h-[calc(100dvh-2.5rem)] lg:grid-cols-[1.08fr_0.92fr]">
        <BrandPanel reduceMotion={Boolean(reduceMotion)} />

        <section className="relative flex items-center justify-center overflow-y-auto px-5 py-7 sm:px-10 sm:py-10 lg:px-14 xl:px-20">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(80,89,210,0.08),transparent_34%)]"
          />

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.58, ease }}
            className="relative z-10 w-full max-w-[460px]"
          >
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <BrandMark dark />
              <SecurityPill />
            </div>

            <div className="mb-7">
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.12, ease }}
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#5059d2]/10 bg-[#5059d2]/[0.07] px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#4149b8]"
              >
                {register ? (
                  <Sparkles className="size-3.5" />
                ) : (
                  <LockKeyhole className="size-3.5" />
                )}
                {register ? "Create your private workspace" : "Welcome to your workspace"}
              </motion.div>

              <h1 className="text-[2.15rem] font-bold leading-[1.04] tracking-[-0.052em] text-[#171a23] sm:text-[2.65rem]">
                {register ? "Start with clarity." : "Welcome back."}
                <span className="block text-[#747b91]">
                  {register ? "Stay in control." : "Your money is waiting."}
                </span>
              </h1>
              <p className="mt-3.5 max-w-[420px] text-[0.9375rem] leading-6 text-[#697086]">
                {register
                  ? "Create one secure account for expenses, card rewards, balances and reimbursements."
                  : "Sign in to see your expenses, card rewards and every amount moving through your life."}
              </p>
            </div>

            <MobileFeatureStrip />

            <AnimatePresence initial={false}>
              {notice && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, height: 0, y: -6 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  role="status"
                  className="mb-4 flex items-start gap-2.5 overflow-hidden rounded-[12px] border border-[#14825f]/15 bg-[#eaf8f2] px-3.5 py-3 text-sm leading-5 text-[#137557]"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {notice}
                </motion.div>
              )}
            </AnimatePresence>

            <form className="space-y-4" onSubmit={submit} noValidate={false}>
              <AuthField label="Email address" htmlFor="auth-email">
                <div className="group relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-[1.05rem] -translate-y-1/2 text-[#a1a7b6] transition-colors group-focus-within:text-[#5059d2]" />
                  <input
                    id="auth-email"
                    name="email"
                    className="field h-[3.25rem] rounded-[12px] border-[#dfe2ea] bg-[#fafbfc] pl-11 pr-11 text-[0.9375rem] shadow-[0_1px_2px_rgba(17,24,39,0.02)] transition-all focus:border-[#6870dc] focus:bg-white focus:shadow-[0_0_0_4px_rgba(80,89,210,0.09)]"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus={!register}
                  />
                  <AnimatePresence>
                    {isEmailReady(email) && (
                      <motion.span
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        className="absolute right-3.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-[#e1f5ec] text-[#13805c]"
                      >
                        <Check className="size-3" strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </AuthField>

              <AuthField
                label="Password"
                htmlFor="auth-password"
                detail={register ? "6+ characters" : "Encrypted sign in"}
              >
                <div className="group relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-[1.05rem] -translate-y-1/2 text-[#a1a7b6] transition-colors group-focus-within:text-[#5059d2]" />
                  <input
                    id="auth-password"
                    name="password"
                    className="field h-[3.25rem] rounded-[12px] border-[#dfe2ea] bg-[#fafbfc] pl-11 pr-12 text-[0.9375rem] shadow-[0_1px_2px_rgba(17,24,39,0.02)] transition-all focus:border-[#6870dc] focus:bg-white focus:shadow-[0_0_0_4px_rgba(80,89,210,0.09)]"
                    type={showPassword ? "text" : "password"}
                    autoComplete={register ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={detectCapsLock}
                    onKeyUp={detectCapsLock}
                    minLength={register ? 6 : undefined}
                    placeholder={register ? "Choose a secure password" : "Enter your password"}
                    required
                  />
                  <VisibilityButton
                    visible={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                    label="password"
                  />
                </div>
                <AnimatePresence initial={false}>
                  {capsLock && (
                    <motion.p
                      initial={reduceMotion ? false : { opacity: 0, y: -3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-1.5 flex items-center gap-1.5 text-[0.72rem] font-medium text-[#a65b00]"
                    >
                      <span className="size-1.5 rounded-full bg-[#e59a34]" />
                      Caps Lock is on
                    </motion.p>
                  )}
                </AnimatePresence>
                {register && password.length > 0 && (
                  <PasswordStrength score={passwordScore} />
                )}
              </AuthField>

              <AnimatePresence initial={false}>
                {register && (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, ease }}
                    className="space-y-4"
                  >
                    <AuthField label="Confirm password" htmlFor="auth-confirm-password">
                      <div className="group relative">
                        <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-[1.05rem] -translate-y-1/2 text-[#a1a7b6] transition-colors group-focus-within:text-[#5059d2]" />
                        <input
                          id="auth-confirm-password"
                          name="confirmPassword"
                          className="field h-[3.25rem] rounded-[12px] border-[#dfe2ea] bg-[#fafbfc] pl-11 pr-11 text-[0.9375rem] transition-all focus:border-[#6870dc] focus:bg-white focus:shadow-[0_0_0_4px_rgba(80,89,210,0.09)]"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          onKeyDown={detectCapsLock}
                          onKeyUp={detectCapsLock}
                          placeholder="Enter it once more"
                          minLength={6}
                          required
                        />
                        {passwordMatch && (
                          <span className="absolute right-3.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-[#e1f5ec] text-[#13805c]">
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                        )}
                      </div>
                    </AuthField>

                    <AuthField
                      label="Registration secret"
                      htmlFor="auth-registration-secret"
                      detail="Invite only"
                    >
                      <div className="group relative">
                        <ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 size-[1.05rem] -translate-y-1/2 text-[#a1a7b6] transition-colors group-focus-within:text-[#5059d2]" />
                        <input
                          id="auth-registration-secret"
                          name="registrationSecret"
                          className="field h-[3.25rem] rounded-[12px] border-[#dfe2ea] bg-[#fafbfc] pl-11 pr-12 text-[0.9375rem] transition-all focus:border-[#6870dc] focus:bg-white focus:shadow-[0_0_0_4px_rgba(80,89,210,0.09)]"
                          type={showSecret ? "text" : "password"}
                          autoComplete="off"
                          value={registrationSecret}
                          onChange={(event) =>
                            setRegistrationSecret(event.target.value)
                          }
                          placeholder="Enter your invitation secret"
                          required
                        />
                        <VisibilityButton
                          visible={showSecret}
                          onClick={() => setShowSecret((value) => !value)}
                          label="registration secret"
                        />
                      </div>
                      <p className="mt-1.5 flex items-center gap-1.5 text-[0.72rem] text-[#7d8496]">
                        <ShieldCheck className="size-3.5 text-[#168361]" />
                        Checked securely on the server
                      </p>
                    </AuthField>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="popLayout" initial={false}>
                {error && (
                  <motion.div
                    key={error}
                    initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5 }}
                    role="alert"
                    className="flex items-start gap-2.5 rounded-[12px] border border-[#d94b4b]/10 bg-[#fff0ef] px-3.5 py-3 text-sm leading-5 text-[#be3636]"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#d94b4b]" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={reduceMotion ? undefined : { y: -1 }}
                whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                transition={{ duration: 0.18 }}
                className="group relative flex h-[3.25rem] w-full items-center justify-center gap-2 overflow-hidden rounded-[12px] bg-[#171a23] px-4 text-[0.9375rem] font-semibold text-white shadow-[0_10px_25px_rgba(23,26,35,0.18)] transition-colors hover:bg-[#262b38] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
              >
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                />
                <span className="relative flex items-center gap-2">
                  {submitting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      {register ? "Creating your workspace…" : "Opening LedgerKit…"}
                    </>
                  ) : (
                    <>
                      {register ? "Create secure account" : "Continue to LedgerKit"}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </span>
              </motion.button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-[#e7e9ef]" />
              <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#a0a5b2]">
                {register ? "Already set up?" : "First time here?"}
              </span>
              <span className="h-px flex-1 bg-[#e7e9ef]" />
            </div>

            <Link
              className="group mt-4 flex h-11 w-full items-center justify-center gap-1.5 rounded-[11px] border border-[#dfe2ea] bg-white text-sm font-semibold text-[#4b5265] transition-all hover:border-[#bfc4d0] hover:bg-[#fafbfc] hover:text-[#171a23]"
              href={register ? "/login" : "/register"}
            >
              {register ? "Sign in instead" : "Create an account"}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[0.72rem] text-[#8b91a0]">
              <ShieldCheck className="size-3.5" />
              Your financial data stays isolated to your account
            </p>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

function BackgroundGlow({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 24, 0], y: [0, -18, 0], scale: [1, 1.08, 1] }
        }
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-24 -top-32 size-[420px] rounded-full bg-[#7d84ec]/20 blur-[100px]"
      />
      <motion.div
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -30, 0], y: [0, 24, 0], scale: [1.05, 0.96, 1.05] }
        }
        transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-40 right-0 size-[500px] rounded-full bg-[#5fd1ad]/15 blur-[120px]"
      />
    </div>
  );
}

function BrandPanel({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <aside className="relative hidden overflow-hidden bg-[#11141d] p-10 text-white lg:flex lg:flex-col xl:p-14">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.055] [background-image:linear-gradient(rgba(255,255,255,.65)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.65)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]"
      />
      <motion.div
        aria-hidden
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 35, 0], y: [0, 18, 0], scale: [1, 1.08, 1] }
        }
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-40 top-1/3 size-[500px] rounded-full bg-[#5059d2]/30 blur-[120px]"
      />
      <motion.div
        aria-hidden
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -20, 0], y: [0, 30, 0], scale: [1.05, 0.96, 1.05] }
        }
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-48 -top-36 size-[500px] rounded-full bg-[#25a47a]/25 blur-[135px]"
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="relative z-10 flex items-center justify-between"
      >
        <BrandMark />
        <SecurityPill dark />
      </motion.div>

      <div className="relative z-10 my-auto py-10 xl:py-14">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.08, ease }}
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-white/75 backdrop-blur">
            <Sparkles className="size-3.5 text-[#8ce0c0]" />
            Built for the way money actually moves
          </div>
          <h2 className="max-w-[590px] text-[3rem] font-semibold leading-[1.01] tracking-[-0.06em] xl:text-[4rem]">
            Know your money.
            <br />
            <span className="bg-gradient-to-r from-white/55 via-white/85 to-[#9be4c7] bg-clip-text text-transparent">
              Keep every reward.
            </span>
          </h2>
          <p className="mt-5 max-w-[515px] text-[0.95rem] leading-6 text-white/55">
            A private command centre for expenses, cards, reimbursements and the
            everyday balances that spreadsheets forget.
          </p>
        </motion.div>

        <ProductPreview reduceMotion={reduceMotion} />
      </div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.55 }}
        className="relative z-10 grid grid-cols-3 gap-3"
      >
        <Feature icon={Zap} label="Live rewards" />
        <Feature icon={ReceiptText} label="Clean records" />
        <Feature icon={ShieldCheck} label="Private by default" />
      </motion.div>
    </aside>
  );
}

function ProductPreview({ reduceMotion }: { reduceMotion: boolean }) {
  const bars = [36, 58, 44, 76, 62, 89, 70];
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.72, delay: 0.25, ease }}
      className="relative mt-9 max-w-[610px]"
    >
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl xl:p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#7cdbc0] shadow-[0_0_14px_rgba(124,219,192,0.8)]" />
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-white/45">
                Sample workspace
              </p>
            </div>
            <p className="mt-2 text-[1.75rem] font-semibold tracking-[-0.045em]">
              Everything reconciled
            </p>
            <p className="mt-1 text-xs text-white/40">
              Spending, rewards and money owed in one view
            </p>
          </div>
          <span className="flex size-11 items-center justify-center rounded-[13px] bg-[#8ce0c0]/10 text-[#8ce0c0]">
            <BarChart3 className="size-5" />
          </span>
        </div>

        <div className="mt-6 flex h-20 items-end gap-2 rounded-[15px] border border-white/[0.06] bg-black/10 px-3 pb-3 pt-2">
          {bars.map((height, index) => (
            <motion.span
              key={height}
              initial={reduceMotion ? false : { height: 6, opacity: 0.35 }}
              animate={{ height: `${height}%`, opacity: 1 }}
              transition={{
                duration: 0.65,
                delay: 0.45 + index * 0.07,
                ease,
              }}
              className={cn(
                "min-w-0 flex-1 rounded-t-[5px]",
                index === bars.length - 2
                  ? "bg-[#8ce0c0]"
                  : "bg-white/[0.16]",
              )}
            />
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <PreviewMetric label="Expenses" value="Categorised" />
          <PreviewMetric label="Cards" value="Optimised" />
          <PreviewMetric label="Balances" value="Accounted" />
        </div>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, x: 18, scale: 0.92 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.55, delay: 0.7, ease }}
        className="absolute -right-5 -top-7 hidden items-center gap-2.5 rounded-[14px] border border-white/10 bg-[#242937]/95 px-3.5 py-3 shadow-2xl backdrop-blur xl:flex"
      >
        <span className="flex size-8 items-center justify-center rounded-[9px] bg-[#8ce0c0]/12 text-[#8ce0c0]">
          <TrendingUp className="size-4" />
        </span>
        <span>
          <span className="block text-[0.68rem] text-white/40">Reward engine</span>
          <span className="block text-xs font-semibold text-white/90">
            Best rate matched
          </span>
        </span>
      </motion.div>
    </motion.div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-black/10 px-3 py-2.5">
      <p className="text-[0.62rem] text-white/35">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold text-white/85">{value}</p>
    </div>
  );
}

function Feature({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[0.7rem] font-medium text-white/45">
      <span className="flex size-7 items-center justify-center rounded-[8px] border border-white/[0.08] bg-white/[0.05]">
        <Icon className="size-3.5" />
      </span>
      <span>{label}</span>
    </div>
  );
}

function MobileFeatureStrip() {
  return (
    <div className="mb-5 grid grid-cols-3 gap-2 lg:hidden">
      {[
        ["Rewards", "Calculated"],
        ["Records", "Private"],
        ["Balances", "Clear"],
      ].map(([label, value]) => (
        <div
          key={label}
          className="rounded-[11px] border border-[#e5e7ee] bg-[#fafbfc] px-2.5 py-2"
        >
          <p className="truncate text-[0.62rem] text-[#959baa]">{label}</p>
          <p className="mt-0.5 truncate text-[0.7rem] font-semibold text-[#4d5364]">
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

function SecurityPill({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[0.66rem] font-semibold",
        dark
          ? "border-white/10 bg-white/[0.05] text-white/55"
          : "border-[#e1e4eb] bg-white/75 text-[#70778a]",
      )}
    >
      <ShieldCheck className="size-3.5" />
      Secure
    </span>
  );
}

function BrandMark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-[12px] shadow-sm",
          dark ? "bg-[#171a23] text-white" : "bg-white text-[#14171f]",
        )}
      >
        <Wallet className="size-5" aria-hidden />
      </span>
      <div className="leading-tight">
        <div
          className={cn(
            "text-lg font-bold tracking-[-0.035em]",
            dark ? "text-[#171a23]" : "text-white",
          )}
        >
          LedgerKit
        </div>
        <div
          className={cn(
            "text-[0.62rem] font-semibold tracking-[0.11em]",
            dark ? "text-[#979dac]" : "text-white/40",
          )}
        >
          MONEY, MADE CLEAR
        </div>
      </div>
    </div>
  );
}

function VisibilityButton({
  visible,
  onClick,
  label,
}: {
  visible: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[12px] text-[#989eac] transition-colors hover:text-[#303544] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6870dc] focus-visible:ring-inset"
      onClick={onClick}
      aria-label={visible ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={visible}
    >
      {visible ? (
        <EyeOff className="size-[1.05rem]" />
      ) : (
        <Eye className="size-[1.05rem]" />
      )}
    </button>
  );
}

function PasswordStrength({ score }: { score: number }) {
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              bar <= score
                ? score <= 1
                  ? "bg-[#d95c55]"
                  : score === 2
                    ? "bg-[#e5a243]"
                    : "bg-[#2fa57b]"
                : "bg-[#e8eaf0]",
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-right text-[0.68rem] font-medium text-[#8b91a0]">
        Password strength: {labels[score]}
      </p>
    </div>
  );
}

function AuthField({
  label,
  htmlFor,
  detail,
  children,
}: {
  label: string;
  htmlFor?: string;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[0.8125rem] font-semibold text-[#282c38]">
        <label htmlFor={htmlFor}>{label}</label>
        {detail && (
          <span className="font-normal text-[#959baa]">{detail}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function isEmailReady(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getPasswordScore(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}
