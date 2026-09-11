"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronRight,
  CreditCard,
  RefreshCw,
  SlidersHorizontal,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { useReference, useSummary } from "@/lib/client-api";
import { formatMoney, formatMoneyShort, percentFromBps } from "@/lib/money";
import { rewardAutomationEnabled } from "@/lib/rewards/coverage";
import { Button, Chip, EmptyState, Panel, Spinner } from "@/components/ui/primitives";
import { CardBillingDashboard } from "@/components/cards/card-billing";

export default function CardsPage() {
  const now = new Date();
  const {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useSummary(now.getFullYear(), now.getMonth() + 1);
  const {
    data: reference,
    error: referenceError,
    isLoading: isReferenceLoading,
    isFetching: isReferenceFetching,
    refetch: refetchReference,
  } = useReference();

  const summary = data?.summary;
  const selectedIds = new Set(reference?.instruments.map((card) => card.id) ?? []);
  const visibleCards =
    summary?.cards.filter((card) => selectedIds.has(card.instrument.id)) ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.375rem] font-semibold tracking-[-0.025em]">
            Cards &amp; rewards
          </h1>
          <p className="hint mt-0.5">
            Your cards, their reward details and what they have earned this
            month.
          </p>
        </div>
        <Link
          href="/settings#my-cards"
          className="btn btn-secondary btn-sm"
        >
          <SlidersHorizontal className="size-3.5" />
          Manage cards
        </Link>
      </header>

      <CardBillingDashboard compact />

      {error || referenceError ? (
        <Panel>
          <EmptyState
            icon={<TriangleAlert className="size-5" />}
            title="Cards could not be loaded"
            body={(error ?? referenceError)?.message ?? "Please try again."}
            action={
              <Button
                variant="secondary"
                loading={isFetching || isReferenceFetching}
                onClick={() => {
                  void refetch();
                  void refetchReference();
                }}
              >
                <RefreshCw className="size-4" />
                Try again
              </Button>
            }
          />
        </Panel>
      ) : isLoading || isReferenceLoading || !summary || !reference ? (
        <div className="flex justify-center py-20">
          <Spinner className="size-5" />
        </div>
      ) : visibleCards.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<WalletCards className="size-5" />}
            title="Your card wallet is empty"
            body="Choose the credit cards you use and LedgerKit will show their coverage information and any available reward estimates."
            action={
              <Link href="/settings#my-cards" className="btn btn-primary">
                <CreditCard className="size-4" />
                Choose my cards
              </Link>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleCards.map((card) => {
            const rules = (reference?.rules ?? []).filter(
              (r) => r.instrumentId === card.instrument.id && r.active,
            );
            const perks = safeJson<string[]>(card.instrument.perks, []);
            const excluded = safeJson<string[]>(
              card.instrument.excludedCategories,
              [],
            );
            const rewardIsCalculable = rewardAutomationEnabled(card.instrument);
            const rewardIsEstimate = card.instrument.rewardCoverage === "partial";

            return (
              <Link
                key={card.instrument.id}
                href={`/cards/${card.instrument.id}`}
                className="group block focus-visible:outline-none"
              >
                <article className="panel h-full overflow-hidden transition-shadow group-hover:shadow-[0_2px_14px_rgba(16,24,40,0.09)] group-focus-visible:ring-2 group-focus-visible:ring-accent">
                  <div
                    className="flex items-center justify-between gap-3 p-4 text-white"
                    style={{
                      background: `linear-gradient(135deg, ${card.instrument.colorFrom} 0%, ${card.instrument.colorTo} 100%)`,
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[0.9375rem] font-semibold">
                        {card.instrument.name}
                      </p>
                      <p className="text-[0.75rem] text-white/70">
                        {card.instrument.kind === "credit" ? "Credit" : "Debit"} ·{" "}
                        {card.instrument.network.toUpperCase()} ·{" "}
                        {rewardIsCalculable
                          ? rewardIsEstimate
                            ? `estimated rewards in ${card.instrument.rewardUnit}`
                            : `rewards in ${card.instrument.rewardUnit}`
                          : "manual reward tracking"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[0.6875rem] text-white/65">this month</p>
                      <p className="figure text-[1.125rem]">
                        {formatMoneyShort(card.netSpendPaise)}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-white/40 transition-colors group-hover:text-white/80" />
                  </div>

                  <div className="space-y-3 p-4">
                    <ul className="space-y-1.5">
                      {rules.length === 0 && (
                        <li className="text-[0.8125rem] text-ink-2">
                          {rewardIsCalculable
                            ? "No supported reward rules are available for this card yet."
                            : "Reward rules are not automated for this card. Check the linked issuer terms for the current programme."}
                        </li>
                      )}
                      {rules.slice(0, 5).map((rule) => (
                        <li
                          key={rule.id}
                          className="flex items-baseline justify-between gap-3 text-[0.8125rem]"
                        >
                          <span className="min-w-0 truncate text-ink-2">
                            {rule.name}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="font-semibold tnum">
                              {rule.rateType === "percent"
                                ? percentFromBps(rule.rateBps)
                                : `${rule.pointsPerBlock}/₹${rule.blockSizePaise / 100}`}
                            </span>
                            {rule.capUnits != null ? (
                              <Chip tone="neutral">
                                cap{" "}
                                {card.instrument.rewardUnit === "INR" ? "₹" : ""}
                                {rule.capUnits.toLocaleString("en-IN")}/
                                {rule.capPeriod === "quarter" ? "qtr" : rule.capPeriod === "statement" ? "cycle" : rule.capPeriod}
                              </Chip>
                            ) : (
                              <Chip tone="gain">uncapped</Chip>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {card.instrument.overallCapUnits != null && (
                      <p className="rounded-[9px] bg-warn-soft px-2.5 py-1.5 text-[0.75rem] text-warn">
                        Card-wide ceiling of{" "}
                        {card.instrument.rewardUnit === "INR" ? "₹" : ""}
                        {card.instrument.overallCapUnits.toLocaleString("en-IN")} per{" "}
                        {card.instrument.overallCapPeriod} across every category.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1.5 border-t border-rule pt-3">
                      {rewardIsCalculable ? (
                        <Chip tone={card.rewardValuePaise > 0 ? "gain" : "neutral"}>
                          {formatMoney(card.rewardValuePaise)}{" "}
                          {rewardIsEstimate ? "estimated" : "earned"}
                        </Chip>
                      ) : (
                        <Chip tone="neutral">reward calculation not automated</Chip>
                      )}
                      {rewardIsEstimate && (
                        <Chip tone="warn">partial coverage · verify statement</Chip>
                      )}
                      {rewardIsCalculable && card.rewardLostPaise > 0 && (
                        <Chip tone="warn">
                          {formatMoney(card.rewardLostPaise)}{" "}
                          {rewardIsEstimate ? "estimated lost to caps" : "lost to caps"}
                        </Chip>
                      )}
                      <Chip tone="neutral">{card.txnCount} spends</Chip>
                      {excluded.length > 0 && (
                        <Chip tone="neutral">
                          {excluded.length} excluded categories
                        </Chip>
                      )}
                    </div>

                    {perks.length > 0 && (
                      <p className="text-[0.75rem] leading-relaxed text-ink-3">
                        {perks[0]}
                        {perks.length > 1 && ` · +${perks.length - 1} more`}
                      </p>
                    )}
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}

      <Panel title="How the engine picks a rate">
        <ol className="space-y-2 text-[0.8438rem] leading-relaxed text-ink-2">
          <li>
            <strong className="font-semibold text-ink">Most specific rule wins.</strong>{" "}
            A merchant rule beats a payment-app rule, which beats a category rule,
            which beats a channel rule, which beats the card&rsquo;s base rate. Give a
            rule a priority to override that order — this is how SmartBuy routing
            correctly knocks HDFC partner merchants down to 1%.
          </li>
          <li>
            <strong className="font-semibold text-ink">Caps apply in date order.</strong>{" "}
            Expenses are replayed chronologically, so the spend that actually
            exhausted a cap is the one that stops earning — not whichever you happened
            to enter last.
          </li>
          <li>
            <strong className="font-semibold text-ink">
              Rule caps sit under the card ceiling.
            </strong>{" "}
            A rule cap is checked first, then any card-wide cap trims what is left.
            Anything you miss is recorded so you can see what the caps cost you.
          </li>
          <li>
            <strong className="font-semibold text-ink">Refunds claw back.</strong>{" "}
            Filing a refund shrinks the reward-eligible amount and the whole card is
            recalculated.
          </li>
        </ol>
      </Panel>
    </div>
  );
}

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}
