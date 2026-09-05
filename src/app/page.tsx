"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Coins,
  Hourglass,
  Receipt,
  RotateCcw,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
} from "recharts";
import { motion, useReducedMotion } from "motion/react";
import { useLoadDemo, useSummary } from "@/lib/client-api";
import { formatMoney, formatMoneyShort, formatMoneyWhole } from "@/lib/money";
import { addMonths, formatDateShort, monthName } from "@/lib/rewards/periods";
import { CardTile } from "@/components/dashboard/card-tile";
import { CategoryIcon } from "@/components/expenses/category-picker";
import { ExpenseSheet, useExpenseSheet } from "@/components/expenses/expense-sheet";
import {
  Button,
  Chip,
  EmptyState,
  Panel,
  Spinner,
  Tooltip,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const now = new Date();
  const [cursor, setCursor] = React.useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const { data, isLoading } = useSummary(cursor.year, cursor.month);
  const loadDemo = useLoadDemo();
  const sheet = useExpenseSheet();
  const reduce = useReducedMotion();

  const summary = data?.summary;
  const totals = summary?.totals;
  const isCurrentMonth =
    cursor.year === now.getFullYear() && cursor.month === now.getMonth() + 1;

  const delta =
    totals && summary && summary.previousNetPaise > 0
      ? ((totals.netSpendPaise - summary.previousNetPaise) /
          summary.previousNetPaise) *
        100
      : null;

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------- month bar */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Previous month"
              onClick={() => setCursor((c) => addMonths(c.year, c.month, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <h1 className="text-[1.125rem] font-semibold tracking-[-0.025em] sm:text-[1.375rem]">
              {monthName(cursor.month, true)} {cursor.year}
            </h1>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Next month"
              disabled={isCurrentMonth}
              onClick={() => setCursor((c) => addMonths(c.year, c.month, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <p className="hint mt-0.5 pl-2">
            {summary
              ? `${summary.txnCount} ${summary.txnCount === 1 ? "expense" : "expenses"} logged`
              : "Loading your month"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setCursor({ year: now.getFullYear(), month: now.getMonth() + 1 })
              }
            >
              Back to this month
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={sheet.openNew}>
            <Receipt className="size-3.5" />
            Add expense
          </Button>
        </div>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Spinner className="size-5" />
        </div>
      )}

      {summary && summary.txnCount === 0 && (
        <Panel>
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="Nothing logged for this month yet"
            body="Add your first expense, or drop in a few weeks of sample transactions to see how the reward engine handles caps on each card."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={sheet.openNew}>
                  Add an expense
                </Button>
                <Button
                  variant="secondary"
                  loading={loadDemo.isPending}
                  onClick={() => loadDemo.mutate({})}
                >
                  Load sample data
                </Button>
              </div>
            }
          />
        </Panel>
      )}

      {summary && summary.txnCount > 0 && totals && (
        <>
          {/* ------------------------------------------------ headline row */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
            <Figure
              label="Net spend"
              value={formatMoneyWhole(totals.netSpendPaise)}
              sub={
                delta != null
                  ? `${delta >= 0 ? "up" : "down"} ${Math.abs(delta).toFixed(0)}% on last month`
                  : "no comparison yet"
              }
              tone={delta != null && delta > 0 ? "warn" : "neutral"}
              icon={
                delta != null && delta >= 0 ? (
                  <ArrowUpRight className="size-4" />
                ) : (
                  <ArrowDownRight className="size-4" />
                )
              }
              tooltip="What you spent after instant discounts, refunds and money already reimbursed."
            />
            <Figure
              label="Rewards earned"
              value={formatMoneyWhole(totals.rewardValuePaise)}
              sub={
                totals.rewardLostToCapPaise > 0
                  ? `${formatMoney(totals.rewardLostToCapPaise)} lost to caps`
                  : "nothing lost to caps"
              }
              tone="gain"
              icon={<Sparkles className="size-4" />}
              tooltip="Cashback and points your cards paid on this month's spending, after every cap."
            />
            <Figure
              label="Discounts claimed"
              value={formatMoneyWhole(
                totals.instantDiscountPaise + totals.deferredBenefitPaise,
              )}
              sub={`${totals.savingsRatePct.toFixed(1)}% of gross clawed back`}
              tone="gain"
              icon={<Coins className="size-4" />}
              tooltip="Coupons, bank offers and extra cashback you logged by hand."
            />
            <Figure
              label="Owed back to you"
              value={formatMoneyWhole(totals.receivablePaise)}
              sub={
                totals.refundPendingPaise > 0
                  ? `${formatMoney(totals.refundPendingPaise)} of it is refunds`
                  : "reimbursements and refunds"
              }
              tone={totals.receivablePaise > 0 ? "warn" : "neutral"}
              icon={<Hourglass className="size-4" />}
              tooltip="Reimbursements still pending plus refunds you have raised but not received."
            />
          </div>

          {/* ------------------------------------------------- wallet rail */}
          <section>
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <h2 className="panel-title">Your wallet</h2>
              <Link
                href="/cards"
                className="text-[0.8125rem] font-medium text-ink-2 hover:text-ink"
              >
                Manage cards and rules
              </Link>
            </div>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              {summary.cards.map((card, i) => (
                <CardTile key={card.instrument.id} summary={card} index={i} />
              ))}
            </div>
          </section>

          {/* -------------------------------------------------- the charts */}
          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <Panel
              title="Where it went"
              subtitle="Net spend by category group"
              bodyClassName="p-4"
            >
              {summary.byCategory.length === 0 ? (
                <p className="hint py-8 text-center">Nothing to show yet.</p>
              ) : (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="h-[176px] w-[176px] shrink-0">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={summary.byCategory}
                          dataKey="netPaise"
                          nameKey="name"
                          innerRadius={52}
                          outerRadius={82}
                          paddingAngle={1.5}
                          stroke="none"
                          isAnimationActive={!reduce}
                        >
                          {summary.byCategory.map((slice) => (
                            <Cell key={slice.slug} fill={slice.colorHex} />
                          ))}
                        </Pie>
                        <RTooltip
                          content={({ payload }) => {
                            const p = payload?.[0]?.payload as
                              | { name: string; netPaise: number; txnCount: number }
                              | undefined;
                            if (!p) return null;
                            return (
                              <div className="rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white">
                                {p.name} · {formatMoney(p.netPaise)}
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-1.5">
                    {summary.byCategory.slice(0, 6).map((slice) => (
                      <li key={slice.slug} className="flex items-center gap-2.5">
                        <span
                          className="flex size-6 shrink-0 items-center justify-center rounded-[7px]"
                          style={{ background: `${slice.colorHex}1a` }}
                        >
                          <CategoryIcon
                            name={slice.icon}
                            className="size-3.5"
                            color={slice.colorHex}
                          />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[0.8438rem]">
                          {slice.name}
                        </span>
                        <span className="shrink-0 text-[0.8438rem] font-medium tnum">
                          {formatMoneyShort(slice.netPaise)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>

            <Panel
              title="Day by day"
              subtitle="Net spend across the month"
              bodyClassName="p-4"
            >
              <div className="h-[176px] w-full">
                <ResponsiveContainer>
                  <BarChart
                    data={summary.byDay}
                    margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                  >
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => d.slice(8, 10)}
                      tickLine={false}
                      axisLine={false}
                      interval={Math.max(1, Math.floor(summary.byDay.length / 8))}
                      tick={{ fill: "#8B90A0", fontSize: 11 }}
                    />
                    <RTooltip
                      cursor={{ fill: "#ECEEF2" }}
                      content={({ payload }) => {
                        const p = payload?.[0]?.payload as
                          | { date: string; netPaise: number; rewardPaise: number }
                          | undefined;
                        if (!p) return null;
                        return (
                          <div className="rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white">
                            <div>{formatDateShort(p.date)}</div>
                            <div className="tnum">{formatMoney(p.netPaise)}</div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="netPaise"
                      radius={[3, 3, 0, 0]}
                      fill="#16181D"
                      isAnimationActive={!reduce}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {/* ----------------------------------------- apps and merchants */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Paid through" subtitle="Which app or rail carried the money">
              <ul className="space-y-2">
                {summary.byApp.slice(0, 6).map((app) => {
                  const share =
                    totals.netSpendPaise > 0
                      ? (app.netPaise / totals.netSpendPaise) * 100
                      : 0;
                  return (
                    <li key={app.slug}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-[0.8438rem]">
                        <span className="truncate">{app.name}</span>
                        <span className="shrink-0 font-medium tnum">
                          {formatMoneyShort(app.netPaise)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                        <motion.div
                          initial={reduce ? false : { width: 0 }}
                          animate={{ width: `${share}%` }}
                          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full rounded-full"
                          style={{ background: app.colorHex }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <Panel title="Biggest merchants" subtitle="Net of refunds and discounts">
              <ul className="divide-y divide-rule">
                {summary.topMerchants.map((m) => (
                  <li
                    key={m.slug ?? m.name}
                    className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0 truncate text-[0.8438rem]">{m.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-[0.75rem] text-ink-3">
                        {m.txnCount}×
                      </span>
                      <span className="text-[0.8438rem] font-medium tnum">
                        {formatMoney(m.netPaise)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {/* ---------------------------------------------------- money in */}
          {(summary.transfersIn > 0 || summary.transfersOut > 0) && (
            <Panel
              title="Money moved between people"
              subtitle="Sent and received this month"
              action={
                <Link
                  href="/people"
                  className="text-[0.8125rem] font-medium text-ink-2 hover:text-ink"
                >
                  See all
                </Link>
              }
            >
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                <MiniStat
                  label="Sent"
                  value={formatMoney(summary.transfersOut)}
                  tone="warn"
                />
                <MiniStat
                  label="Received"
                  value={formatMoney(summary.transfersIn)}
                  tone="gain"
                />
                <MiniStat
                  label="Counted as spend"
                  value={formatMoney(summary.transferSpendPaise)}
                  hint="gifts and your share of splits"
                />
              </div>
            </Panel>
          )}
        </>
      )}

      <ExpenseSheet
        open={sheet.open}
        onOpenChange={sheet.setOpen}
        expenseId={sheet.id}
      />
    </div>
  );
}

function Figure({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
  tooltip,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "gain" | "warn";
  icon?: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <Tooltip content={tooltip}>
      <div className="panel cursor-default p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.8125rem] font-medium text-ink-2">{label}</span>
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-[7px]",
              tone === "gain" && "bg-gain-soft text-gain",
              tone === "warn" && "bg-warn-soft text-warn",
              tone === "neutral" && "bg-sunken text-ink-3",
            )}
          >
            {icon}
          </span>
        </div>
        <p className="figure mt-2 text-[1.375rem] leading-none sm:text-[1.625rem]">{value}</p>
        {sub && <p className="mt-1.5 text-[0.75rem] text-ink-3">{sub}</p>}
      </div>
    </Tooltip>
  );
}

function MiniStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "gain" | "warn";
}) {
  return (
    <div className="rounded-[11px] border border-rule bg-paper p-3">
      <p className="text-[0.75rem] text-ink-2">{label}</p>
      <p
        className={cn(
          "figure mt-1 text-[1.125rem]",
          tone === "gain" && "text-gain",
          tone === "warn" && "text-ink",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[0.6875rem] text-ink-3">{hint}</p>}
    </div>
  );
}
