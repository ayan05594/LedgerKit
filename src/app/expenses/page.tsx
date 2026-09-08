"use client";

import * as React from "react";
import {
  BookOpen,
  Filter,
  Hourglass,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { ExpenseRow } from "@/server/queries";
import { useExpenses, useReference } from "@/lib/client-api";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import { rewardAutomationEnabled } from "@/lib/rewards/coverage";
import { formatDateShort, monthBounds, todayISO } from "@/lib/rewards/periods";
import { CategoryIcon } from "@/components/expenses/category-picker";
import {
  ChannelChip,
  ExpenseSheet,
  useExpenseSheet,
} from "@/components/expenses/expense-sheet";
import {
  Button,
  Chip,
  EmptyState,
  Input,
  Panel,
  Select,
  Spinner,
  Tooltip,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export default function ExpensesPage() {
  const now = new Date();
  const thisMonth = monthBounds(now.getFullYear(), now.getMonth() + 1);

  const [search, setSearch] = React.useState("");
  const [from, setFrom] = React.useState(thisMonth.start);
  const [to, setTo] = React.useState(todayISO());
  const [instrumentId, setInstrumentId] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [categorySlug, setCategorySlug] = React.useState("");
  const [flag, setFlag] = React.useState<"" | "reimbursable" | "refunded">("");
  const [showFilters, setShowFilters] = React.useState(false);

  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: reference } = useReference();
  const {
    data: rows,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useExpenses({
    from,
    to,
    search: debounced || undefined,
    instrumentId: instrumentId || undefined,
    accountId: accountId || undefined,
    categorySlug: categorySlug || undefined,
    reimbursableOnly: flag === "reimbursable" ? "1" : undefined,
    hasRefund: flag === "refunded" ? "1" : undefined,
  });

  const sheet = useExpenseSheet();

  const totals = React.useMemo(() => {
    const list = rows ?? [];
    return {
      gross: list.reduce((s, r) => s + r.math.grossPaise, 0),
      net: list.reduce((s, r) => s + r.math.netSpendPaise, 0),
      reward: list.reduce(
        (s, r) =>
          r.instrument && rewardAutomationEnabled(r.instrument)
            ? s + r.math.rewardValuePaise
            : s,
        0,
      ),
      manualRewardCount: list.filter(
        (r) => r.instrument && !rewardAutomationEnabled(r.instrument),
      ).length,
      estimatedRewardCount: list.filter(
        (r) => r.instrument?.rewardCoverage === "partial",
      ).length,
      owed: list.reduce((s, r) => s + r.math.receivablePaise, 0),
    };
  }, [rows]);

  const filtersActive =
    !!instrumentId || !!accountId || !!categorySlug || !!flag || !!debounced;

  function clearFilters() {
    setInstrumentId("");
    setAccountId("");
    setCategorySlug("");
    setFlag("");
    setSearch("");
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.375rem] font-semibold tracking-[-0.025em]">
            Expenses
          </h1>
          <p className="hint mt-0.5">
            {error
              ? "Could not load expenses"
              : rows
              ? `${rows.length} ${rows.length === 1 ? "expense" : "expenses"} · ${formatMoney(totals.net)} net · ${
                  totals.manualRewardCount > 0
                    ? totals.reward > 0
                      ? `${formatMoney(totals.reward)} automated rewards`
                      : "rewards need a statement check"
                    : totals.estimatedRewardCount > 0
                      ? `${formatMoney(totals.reward)} estimated rewards`
                    : `${formatMoney(totals.reward)} earned back`
                }`
              : "Loading"}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={sheet.openNew}>
          <Plus className="size-3.5" />
          Add expense
        </Button>
      </header>

      {/* ------------------------------------------------------- filter bar */}
      <div className="panel p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
            <Input
              id="expense-search"
              name="expenseSearch"
              aria-label="Search expenses"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, merchant or notes"
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="expense-from-date"
              name="expenseFromDate"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="min-w-0 flex-1 sm:w-auto sm:flex-none"
              aria-label="From date"
            />
            <span className="shrink-0 text-ink-3">to</span>
            <Input
              id="expense-to-date"
              name="expenseToDate"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="min-w-0 flex-1 sm:w-auto sm:flex-none"
              aria-label="To date"
            />
          </div>
          <Button
            variant={showFilters || filtersActive ? "secondary" : "ghost"}
            size="sm"
            className="shrink-0 self-start sm:self-auto"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="size-3.5" />
            Filters
            {filtersActive && (
              <span className="ml-0.5 size-1.5 rounded-full bg-accent" />
            )}
          </Button>
        </div>

        {showFilters && (
          <div className="anim-fade mt-3 grid gap-2 border-t border-rule pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              id="expense-card-filter"
              name="instrumentId"
              value={instrumentId}
              onChange={(e) => setInstrumentId(e.target.value)}
              aria-label="Card"
            >
              <option value="">Any card</option>
              {reference?.instruments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.shortName}
                </option>
              ))}
            </Select>
            <Select
              id="expense-account-filter"
              name="accountId"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              aria-label="Account"
            >
              <option value="">Any account</option>
              {reference?.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select
              id="expense-category-filter"
              name="categorySlug"
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value)}
              aria-label="Category"
            >
              <option value="">Any category</option>
              {reference?.categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.parentSlug ? "  " : ""}
                  {c.name}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Select
                id="expense-special-filter"
                name="specialFilter"
                value={flag}
                onChange={(e) =>
                  setFlag(e.target.value as "" | "reimbursable" | "refunded")
                }
                aria-label="Special"
              >
                <option value="">Everything</option>
                <option value="reimbursable">Reimbursable only</option>
                <option value="refunded">Has a refund</option>
              </Select>
              {filtersActive && (
                <Button variant="ghost" size="icon" onClick={clearFilters} aria-label="Clear filters">
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------- table */}
      <Panel bodyClassName="p-0">
        {error ? (
          <EmptyState
            icon={<Receipt className="size-5" />}
            title="Expenses could not be loaded"
            body={
              error instanceof Error
                ? error.message
                : "The server did not return the expense list."
            }
            action={
              <Button
                variant="secondary"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? (
                  <Spinner className="size-4" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Try again
              </Button>
            }
          />
        ) : isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner className="size-5" />
          </div>
        ) : !rows || rows.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-5" />}
            title="No expenses in this range"
            body={
              filtersActive
                ? "Try widening the dates or clearing a filter."
                : "Add one to track your spending and any supported card reward estimates."
            }
            action={
              filtersActive ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" onClick={sheet.openNew}>
                  Add an expense
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-rule">
            {rows.map((row) => (
              <ExpenseListRow
                key={row.expense.id}
                row={row}
                onOpen={() => sheet.openEdit(row.expense.id)}
              />
            ))}
          </ul>
        )}
      </Panel>

      {rows && rows.length > 0 && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            <Total label="Gross" value={formatMoney(totals.gross)} />
            <Total label="Net spend" value={formatMoney(totals.net)} strong />
            <Total
              label={
                totals.manualRewardCount > 0
                  ? "Automated rewards"
                  : totals.estimatedRewardCount > 0
                    ? "Estimated rewards"
                    : "Earned back"
              }
              value={
                totals.manualRewardCount > 0 && totals.reward === 0
                  ? "Check statements"
                  : formatMoney(totals.reward)
              }
              tone="gain"
            />
            <Total label="Owed to you" value={formatMoney(totals.owed)} tone="warn" />
          </div>
          {totals.manualRewardCount > 0 && (
            <div className="flex items-start gap-2 rounded-[10px] border border-accent/20 bg-accent-soft px-3 py-2.5 text-[0.75rem] leading-relaxed text-ink-2">
              <BookOpen className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
              <p>
                Reward totals exclude {totals.manualRewardCount}{" "}
                {totals.manualRewardCount === 1 ? "expense" : "expenses"} on
                statement-tracked cards. Check those issuer statements for the
                actual points or cashback.
              </p>
            </div>
          )}
          {totals.estimatedRewardCount > 0 && (
            <div className="flex items-start gap-2 rounded-[10px] border border-warn/25 bg-warn-soft px-3 py-2.5 text-[0.75rem] leading-relaxed text-warn">
              <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <p>
                Reward totals include {totals.estimatedRewardCount}{" "}
                {totals.estimatedRewardCount === 1 ? "expense" : "expenses"} using
                partial card coverage. Confirm final rewards on issuer statements.
              </p>
            </div>
          )}
        </div>
      )}

      <ExpenseSheet
        open={sheet.open}
        onOpenChange={sheet.setOpen}
        expenseId={sheet.id}
      />
    </div>
  );
}

function ExpenseListRow({ row, onOpen }: { row: ExpenseRow; onOpen: () => void }) {
  const { expense, math, instrument, account, category, app } = row;
  const rewardIsCalculable = Boolean(
    instrument && rewardAutomationEnabled(instrument),
  );
  const rewardIsEstimate = instrument?.rewardCoverage === "partial";
  const title =
    expense.customLabel ||
    expense.description ||
    expense.merchantName ||
    category?.name ||
    "Expense";

  const payer = instrument?.shortName ?? account?.name ?? "Not recorded";
  const payerColor = instrument?.colorFrom ?? account?.colorHex ?? "#CED4DA";

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="row-hover flex w-full items-center gap-2.5 px-3 py-3 text-left sm:gap-3 sm:px-4"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: `${category?.colorHex ?? "#868E96"}18` }}
        >
          <CategoryIcon
            name={category?.icon ?? "Circle"}
            className="size-4"
            color={category?.colorHex}
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[0.875rem] font-medium">{title}</span>
            {math.refundedPaise > 0 && (
              <Tooltip content={`${formatMoney(math.refundedPaise)} refunded`}>
                <span className="chip chip-gain">
                  <RotateCcw className="size-3" />
                  refund
                </span>
              </Tooltip>
            )}
            {math.reimbursementOutstandingPaise > 0 && (
              <Tooltip
                content={`${formatMoney(math.reimbursementOutstandingPaise)} still to come back from ${expense.reimbursementFrom || "someone"}`}
              >
                <span className="chip chip-warn">
                  <Hourglass className="size-3" />
                  owed
                </span>
              </Tooltip>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-ink-3">
            <span className="tnum">{formatDateShort(expense.occurredAt)}</span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: payerColor }}
              />
              {payer}
            </span>
            {app && (
              <>
                <span aria-hidden>·</span>
                <span>{app.name}</span>
              </>
            )}
            {category && (
              <>
                <span aria-hidden>·</span>
                <span>{category.name}</span>
              </>
            )}
          </span>
        </span>

        <span className="hidden shrink-0 sm:block">
          <ChannelChip channel={expense.channel} />
        </span>

        <span className="w-[88px] shrink-0 text-right sm:w-[110px]">
          <span
            className={cn(
              "block text-[0.9375rem] font-semibold tnum",
              math.refundedPaise > 0 && "text-ink-2",
            )}
          >
            {formatMoney(math.netSpendPaise)}
          </span>
          {rewardIsCalculable && math.rewardValuePaise > 0 && (
            <Tooltip
              content={
                rewardIsEstimate
                  ? `${expense.rewardExplain} This is a partial-coverage estimate.`
                  : expense.rewardExplain
              }
            >
              <span className="mt-0.5 inline-flex items-center gap-1 text-[0.75rem] font-medium text-gain tnum">
                <Sparkles className="size-3" />
                {formatMoneyShort(math.rewardValuePaise)}
                {rewardIsEstimate && <span className="sr-only"> estimated</span>}
              </span>
            </Tooltip>
          )}
          {rewardIsCalculable &&
            math.rewardValuePaise === 0 &&
            expense.rewardExplain &&
            instrument && (
              <Tooltip content={expense.rewardExplain}>
                <span className="mt-0.5 block text-[0.6875rem] text-ink-3">
                  {rewardIsEstimate ? "no estimated reward" : "no reward"}
                </span>
              </Tooltip>
            )}
          {instrument && !rewardIsCalculable && (
            <Tooltip content="LedgerKit does not calculate this card's reward. Check the issuer statement for actual points or cashback.">
              <span className="mt-0.5 inline-flex items-center gap-1 text-[0.6875rem] text-accent">
                <BookOpen className="size-3" aria-hidden />
                statement tracked
              </span>
            </Tooltip>
          )}
        </span>
      </button>
    </li>
  );
}

function Total({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "gain" | "warn";
  strong?: boolean;
}) {
  return (
    <div className="panel p-3">
      <p className="text-[0.75rem] text-ink-2">{label}</p>
      <p
        className={cn(
          "figure mt-1 text-[1.125rem]",
          tone === "gain" && "text-gain",
          tone === "warn" && "text-warn",
          strong && "text-[1.25rem]",
        )}
      >
        {value}
      </p>
    </div>
  );
}
