"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, BookOpen, Infinity as InfinityIcon } from "lucide-react";
import type { CardSummary } from "@/server/queries";
import { formatMoney, formatMoneyShort, formatUnits } from "@/lib/money";
import { rewardAutomationEnabled } from "@/lib/rewards/coverage";
import { Tooltip } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const PERIOD_WORD = {
  month: "mo",
  quarter: "qtr",
  year: "yr",
  statement: "cycle",
  none: "",
} as const;

export function CardTile({
  summary,
  index,
}: {
  summary: CardSummary;
  index: number;
}) {
  const { instrument, netSpendPaise, rewardValuePaise, rewardUnitsMilli, txnCount, caps, rewardLostPaise } = summary;
  const reduce = useReducedMotion();
  const rewardIsCalculable = rewardAutomationEnabled(instrument);
  const rewardIsEstimate = instrument.rewardCoverage === "partial";

  const tightest = caps.reduce<number>((max, c) => Math.max(max, c.pctUsed), 0);
  const exhausted = caps.some((c) => c.pctUsed >= 99.5);

  return (
    <Link
      href={`/cards/${instrument.id}`}
      className="group block w-[260px] shrink-0 focus-visible:outline-none"
    >
      <motion.article
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : index * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-[16px] border border-rule bg-surface transition-shadow group-hover:shadow-[0_2px_14px_rgba(16,24,40,0.09)] group-focus-visible:ring-2 group-focus-visible:ring-accent"
      >
        {/* ---- the card face itself, in the issuer's own colours ---- */}
        <div
          className="relative flex h-[124px] flex-col justify-between p-3.5 text-white"
          style={{
            background: `linear-gradient(135deg, ${instrument.colorFrom} 0%, ${instrument.colorTo} 100%)`,
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[0.875rem] font-semibold tracking-[-0.01em]">
                {instrument.shortName}
              </p>
              <p className="truncate text-[0.6875rem] text-white/65">
                {instrument.issuer}
              </p>
            </div>
            <span className="rounded-[5px] bg-white/18 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-white/90">
              {instrument.network}
            </span>
          </div>

          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[0.6875rem] text-white/65">
                {txnCount === 0
                  ? "Nothing yet"
                  : `${txnCount} ${txnCount === 1 ? "spend" : "spends"}`}
              </p>
              <p className="figure text-[1.375rem] leading-tight">
                {formatMoneyShort(netSpendPaise)}
              </p>
            </div>
            {rewardIsCalculable && rewardValuePaise > 0 && (
              <span className="rounded-[6px] bg-white/18 px-1.5 py-1 text-[0.6875rem] font-semibold tnum">
                {rewardIsEstimate ? "~" : "+"}
                {formatMoneyShort(rewardValuePaise)}
              </span>
            )}
            {!rewardIsCalculable && (
              <span className="rounded-[6px] bg-white/18 px-1.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide">
                Statement
              </span>
            )}
          </div>

          <ArrowUpRight className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/0 transition-colors group-hover:text-white/60" />
        </div>

        {/* ---- cap meters ---- */}
        <div className="space-y-2 p-3">
          {!rewardIsCalculable ? (
            <div>
              <div className="flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-2">
                <BookOpen className="size-3.5 text-accent" aria-hidden />
                Rewards tracked on issuer statement
              </div>
              <p className="mt-1 text-[0.6875rem] leading-relaxed text-ink-3">
                Not included in LedgerKit&apos;s automated reward totals.
              </p>
            </div>
          ) : (
            <>
              {caps.length === 0 ? (
                <div className="flex items-center gap-1.5 text-[0.75rem] text-ink-3">
                  <InfinityIcon className="size-3.5" aria-hidden />
                  {instrument.rewardUnit === "INR" &&
                  summary.rewardValuePaise === 0 &&
                  txnCount > 0
                    ? "No reward rule matched"
                    : "No caps on this card"}
                </div>
              ) : (
                caps.slice(0, 3).map((cap, i) => (
                  <CapMeter
                    key={cap.ruleId}
                    label={cap.ruleName}
                    pct={cap.pctUsed}
                    used={cap.usedUnits}
                    total={cap.capUnits}
                    unit={instrument.rewardUnit}
                    period={PERIOD_WORD[cap.capPeriod]}
                    headroomPaise={cap.headroomSpendPaise}
                    delay={reduce ? 0 : 0.18 + index * 0.05 + i * 0.06}
                  />
                ))
              )}

              {rewardUnitsMilli > 0 && instrument.rewardUnit !== "INR" && (
                <p className="pt-0.5 text-[0.6875rem] text-ink-3">
                  {formatUnits(rewardUnitsMilli, instrument.rewardUnit)}{" "}
                  {rewardIsEstimate ? "estimated" : "earned"} ·
                  worth {formatMoney(rewardValuePaise)}
                </p>
              )}

              {rewardIsEstimate && (
                <p className="text-[0.6875rem] font-medium text-warn">
                  Partial estimate · confirm on your statement
                </p>
              )}

              {rewardLostPaise > 0 && (
                <p className="text-[0.6875rem] font-medium text-warn">
                  {formatMoney(rewardLostPaise)}{" "}
                  {rewardIsEstimate ? "estimated missed" : "missed"} — caps were
                  already full
                </p>
              )}

              {exhausted && (
                <p className="text-[0.6875rem] font-medium text-warn">
                  Move further spending to another card
                </p>
              )}
              {!exhausted && tightest > 0 && tightest < 99.5 && caps.length > 0 && (
                <p className="text-[0.6875rem] text-ink-3">
                  {Math.round(tightest)}% of the tightest cap used
                </p>
              )}
            </>
          )}
        </div>
      </motion.article>
    </Link>
  );
}

export function CapMeter({
  label,
  pct,
  used,
  total,
  unit,
  period,
  headroomPaise,
  delay = 0,
  compact,
}: {
  label: string;
  pct: number;
  used: number;
  total: number;
  unit: string;
  period: string;
  headroomPaise: number | null;
  delay?: number;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const full = pct >= 99.5;
  const close = pct >= 80 && !full;

  const remaining = Math.max(0, total - used);
  const unitLabel = unit === "INR" ? "₹" : "";
  const fmt = (n: number) =>
    unit === "INR"
      ? `₹${Math.round(n).toLocaleString("en-IN")}`
      : `${Math.round(n).toLocaleString("en-IN")}`;

  return (
    <Tooltip
      content={
        full
          ? `The ${label.toLowerCase()} cap is spent for this ${period === "mo" ? "month" : period === "qtr" ? "quarter" : period}. Further spend here earns nothing.`
          : headroomPaise != null
            ? `${fmt(remaining)}${unit === "INR" ? "" : ` ${unit}`} left — about ${formatMoney(headroomPaise)} more spend before this cap is full.`
            : `${fmt(remaining)} of ${fmt(total)} left this ${period}.`
      }
    >
      <div className="cursor-default">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-[0.75rem] font-medium",
              full ? "text-warn" : "text-ink-2",
            )}
          >
            {label}
          </span>
          <span
            className={cn(
              "shrink-0 text-[0.6875rem] tnum",
              full ? "text-warn" : close ? "text-warn" : "text-ink-3",
            )}
          >
            {unitLabel}
            {Math.round(used).toLocaleString("en-IN")}
            <span className="text-ink-3">
              {" / "}
              {unitLabel}
              {Math.round(total).toLocaleString("en-IN")}
            </span>
            <span className="text-ink-3"> {period}</span>
          </span>
        </div>
        <div
          className={cn(
            "overflow-hidden rounded-full bg-sunken",
            compact ? "h-1" : "h-1.5",
          )}
          role="meter"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} cap`}
        >
          <motion.div
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${Math.min(100, pct)}%` }}
            transition={{ delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full"
            style={{
              background: full ? "#B4530A" : close ? "#C97A25" : "#05815E",
            }}
          />
        </div>
      </div>
    </Tooltip>
  );
}
