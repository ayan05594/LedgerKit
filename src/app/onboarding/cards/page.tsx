"use client";

import * as React from "react";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { CardSelectionPicker } from "@/components/cards/card-selection";
import { Button, EmptyState, Spinner } from "@/components/ui/primitives";
import {
  useCardSelection,
  useSaveCardSelection,
} from "@/lib/client-api";

export default function CardOnboardingPage() {
  const {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useCardSelection();
  const saveSelection = useSaveCardSelection();
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [noCards, setNoCards] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (!data || hydrated) return;
    setSelectedIds(data.selectedIds);
    setNoCards(data.completed && data.selectedIds.length === 0);
    setHydrated(true);
  }, [data, hydrated]);

  const canContinue = selectedIds.length > 0 || noCards;

  async function save() {
    if (!canContinue) return;
    try {
      const result = await saveSelection.mutateAsync({
        instrumentIds: selectedIds,
        noCards,
      });
      // A full navigation refreshes the auth metadata used by middleware to
      // enforce this one-time setup step.
      window.location.assign(result.redirectTo ?? "/");
    } catch {
      // The shared mutation handler presents the server message as a toast.
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <main className="min-h-dvh bg-paper">
      <div className="mx-auto grid min-h-dvh max-w-[1440px] lg:grid-cols-[minmax(310px,0.78fr)_minmax(620px,1.45fr)]">
        <OnboardingIntro onSignOut={signOut} />

        <section className="flex min-h-dvh min-w-0 flex-col bg-surface lg:border-l lg:border-rule">
          <header className="sticky top-0 z-20 border-b border-rule bg-surface/95 px-4 py-4 backdrop-blur sm:px-8 lg:px-10">
            <div className="mx-auto flex max-w-[820px] items-center justify-between gap-4">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-accent">
                  Personalise your wallet
                </p>
                <h1 className="mt-1 text-[1.25rem] font-semibold tracking-[-0.025em] sm:text-[1.5rem]">
                  Which credit cards do you use?
                </h1>
              </div>
              <span className="shrink-0 rounded-full border border-rule-strong bg-paper px-3 py-1 text-[0.6875rem] font-medium text-ink-2">
                Final step
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Registration progress"
              aria-valuemin={0}
              aria-valuemax={2}
              aria-valuenow={2}
              className="mx-auto mt-3 h-1 max-w-[820px] overflow-hidden rounded-full bg-rule"
            >
              <span className="block h-full w-full rounded-full bg-accent" />
            </div>
          </header>

          <div className="flex-1 px-4 py-5 sm:px-8 sm:py-7 lg:px-10">
            <div className="mx-auto max-w-[820px]">
              <p className="max-w-[65ch] text-[0.875rem] leading-relaxed text-ink-2">
                Select every card you currently hold. LedgerKit will keep the
                expense form focused and show available reward rules, coverage
                notes and benefits for your wallet.
              </p>

              {error ? (
                <div className="mt-6 rounded-[14px] border border-rule bg-paper">
                  <EmptyState
                    icon={<CreditCard className="size-5" />}
                    title="The card catalogue could not be loaded"
                    body={error.message}
                    action={
                      <Button
                        variant="secondary"
                        loading={isFetching}
                        onClick={() => void refetch()}
                      >
                        <RefreshCw className="size-4" />
                        Try again
                      </Button>
                    }
                  />
                </div>
              ) : isLoading || !data || !hydrated ? (
                <div
                  className="mt-6 flex min-h-[420px] flex-col items-center justify-center rounded-[14px] border border-rule bg-paper"
                  aria-live="polite"
                >
                  <Spinner className="size-5" />
                  <p className="mt-3 text-[0.8125rem] text-ink-2">
                    Loading the verified card catalogue…
                  </p>
                </div>
              ) : (
                <CardSelectionPicker
                  className="mt-6"
                  catalog={data.catalog}
                  selectedIds={selectedIds}
                  noCards={noCards}
                  onSelectedIdsChange={(ids) => {
                    saveSelection.reset();
                    setSelectedIds(ids);
                  }}
                  onNoCardsChange={(value) => {
                    saveSelection.reset();
                    setNoCards(value);
                  }}
                />
              )}
            </div>
          </div>

          {!error && data && hydrated && (
            <footer className="sticky bottom-0 z-20 border-t border-rule bg-surface/95 px-4 py-3 backdrop-blur sm:px-8 sm:py-4 lg:px-10">
              <div className="mx-auto flex max-w-[820px] flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-center sm:text-left" aria-live="polite">
                  <p className="text-[0.75rem] text-ink-3">
                    {canContinue
                      ? noCards
                        ? "Continue without credit cards"
                        : `${selectedIds.length} ${selectedIds.length === 1 ? "card" : "cards"} will be added`
                      : "Choose at least one card, or select the no-card option"}
                  </p>
                  {saveSelection.error && (
                    <p role="alert" className="mt-0.5 text-[0.75rem] text-alert">
                      {saveSelection.error.message}
                    </p>
                  )}
                </div>
                <Button
                  variant="primary"
                  className="w-full sm:w-auto"
                  disabled={!canContinue}
                  loading={saveSelection.isPending}
                  onClick={() => void save()}
                >
                  Finish setup
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </footer>
          )}
        </section>
      </div>
    </main>
  );
}

function OnboardingIntro({ onSignOut }: { onSignOut: () => void }) {
  return (
    <aside className="relative overflow-hidden bg-ink px-5 py-5 text-white sm:px-8 lg:flex lg:min-h-dvh lg:flex-col lg:px-10 lg:py-8">
      <div
        className="pointer-events-none absolute -right-24 top-28 size-80 rounded-full bg-accent/35 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-28 -left-20 size-72 rounded-full bg-gain/20 blur-3xl"
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-white text-ink shadow-sm">
            <Wallet className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-[0.9375rem] font-semibold tracking-[-0.02em]">
              LedgerKit
            </p>
            <p className="text-[0.6875rem] text-white/55">
              spend · rewards · refunds
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-white/70 hover:bg-white/10 hover:text-white"
          onClick={onSignOut}
        >
          <LogOut className="size-3.5" />
          Sign out
        </Button>
      </div>

      <div className="relative mt-10 hidden lg:block">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.6875rem] font-medium text-white/70">
          <Sparkles className="size-3" aria-hidden />
          Built around your wallet
        </span>
        <h2 className="mt-5 max-w-[10ch] text-[2.65rem] font-semibold leading-[1.02] tracking-[-0.055em]">
          Better reward answers start here.
        </h2>
        <p className="mt-5 max-w-[34ch] text-[0.875rem] leading-relaxed text-white/60">
          We only show cards you own, so logging a purchase stays quick and every
          reward estimate stays relevant.
        </p>
      </div>

      <ul className="relative mt-5 grid gap-2 sm:grid-cols-3 lg:mt-auto lg:grid-cols-1 lg:gap-3">
        <IntroPoint
          icon={<CreditCard className="size-4" />}
          title="A cleaner expense form"
          body="Card menus only contain the cards you select."
        />
        <IntroPoint
          icon={<ShieldCheck className="size-4" />}
          title="Issuer-sourced details"
          body="Each catalogue card links back to its official source."
        />
        <IntroPoint
          icon={<CheckCircle2 className="size-4" />}
          title="Always reversible"
          body="Add or remove cards later from Settings."
        />
      </ul>
    </aside>
  );
}

function IntroPoint({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3 rounded-[12px] border border-white/10 bg-white/[0.045] p-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-white/10 text-white/80">
        {icon}
      </span>
      <span>
        <span className="block text-[0.8125rem] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-white/55">
          {body}
        </span>
      </span>
    </li>
  );
}
