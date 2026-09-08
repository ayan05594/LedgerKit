"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpen, ExternalLink, Sparkles, TriangleAlert } from "lucide-react";
import type { RewardPreview } from "@/lib/client-api";
import { formatMoney, formatUnits } from "@/lib/money";
import { CapMeter } from "@/components/dashboard/card-tile";
import { Spinner } from "@/components/ui/primitives";

const PERIOD_WORD = {
  month: "mo",
  quarter: "qtr",
  year: "yr",
  statement: "cycle",
  none: "",
} as const;

export function RewardPreviewPanel({
  preview,
  loading,
  cardName,
  automated = true,
  estimated = false,
  officialUrl,
}: {
  preview: RewardPreview | null;
  loading: boolean;
  cardName: string;
  automated?: boolean;
  estimated?: boolean;
  officialUrl?: string;
}) {
  const reduce = useReducedMotion();
  const earns = !!preview && preview.valuePaise > 0;
  const capped = !!preview && preview.cappedUnitsMilli > 0;

  if (!automated) {
    return (
      <div className="rounded-[11px] border border-accent/20 bg-accent-soft p-3">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-surface text-accent">
            <BookOpen className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.75rem] font-medium text-ink-2">Reward tracking</p>
            <p className="mt-0.5 text-[0.9375rem] font-semibold text-ink">
              Not calculated by LedgerKit
            </p>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-2">
              Check {cardName ? `${cardName}'s` : "the card's"} issuer statement for
              points or cashback. This expense is excluded from automated reward
              totals.
            </p>
            {officialUrl && (
              <a
                href={officialUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[0.75rem] font-semibold text-accent hover:underline"
              >
                Review official card terms
                <ExternalLink className="size-3" aria-hidden />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[11px] border border-rule-strong bg-paper p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.75rem] font-medium text-ink-2">
            {estimated
              ? cardName
                ? `Estimated ${cardName} reward`
                : "Estimated reward on this spend"
              : cardName
                ? `What ${cardName} pays back`
                : "Reward on this spend"}
          </p>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={preview ? `${preview.valuePaise}-${preview.ruleId}` : "none"}
              initial={reduce ? false : { opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="mt-1 flex items-baseline gap-2"
              aria-live="polite"
            >
              <span
                className={`figure text-[1.5rem] leading-none ${earns ? "text-gain" : "text-ink-3"}`}
              >
                {preview ? formatMoney(preview.valuePaise) : "₹0.00"}
              </span>
              {preview && preview.rewardUnit !== "INR" && preview.unitsMilli > 0 && (
                <span className="text-[0.8125rem] text-ink-2 tnum">
                  {formatUnits(preview.unitsMilli, preview.rewardUnit)}
                </span>
              )}
            </motion.div>
          </AnimatePresence>

          <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-2">
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner className="size-3" /> Working it out…
              </span>
            ) : (
              (preview?.explain ?? "Pick a card and an amount to see this.")
            )}
          </p>
        </div>

        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-[9px] ${
            capped ? "bg-warn-soft text-warn" : earns ? "bg-gain-soft text-gain" : "bg-sunken text-ink-3"
          }`}
        >
          {capped ? (
            <TriangleAlert className="size-4" />
          ) : (
            <Sparkles className="size-4" />
          )}
        </span>
      </div>

      {estimated && (
        <div className="mt-3 flex items-start gap-2 rounded-[9px] border border-warn/25 bg-warn-soft px-2.5 py-2 text-[0.75rem] leading-relaxed text-warn">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <p>
            Partial coverage: this is an estimate from the supported reward rules.
            Confirm the final reward on your issuer statement
            {officialUrl ? (
              <>
                {" "}or in the{" "}
                <a
                  href={officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline underline-offset-2"
                >
                  official terms
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </>
            ) : null}
            .
          </p>
        </div>
      )}

      {preview && preview.caps.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-rule pt-3">
          {preview.caps.map((cap) => (
            <CapMeter
              key={cap.ruleId}
              compact
              label={cap.ruleName}
              pct={cap.pctUsed}
              used={cap.usedUnits}
              total={cap.capUnits}
              unit={preview.rewardUnit}
              period={PERIOD_WORD[cap.capPeriod]}
              headroomPaise={cap.headroomSpendPaise}
            />
          ))}
        </div>
      )}
    </div>
  );
}
