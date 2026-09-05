"use client";

import * as React from "react";
import { CheckCheck, Hourglass, RotateCcw, Wallet } from "lucide-react";
import type { ExpenseRow } from "@/server/queries";
import {
  usePending,
  useRecordReimbursement,
  useUpdateRefund,
} from "@/lib/client-api";
import { formatMoney, toPaise } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/rewards/periods";
import { ExpenseSheet, useExpenseSheet } from "@/components/expenses/expense-sheet";
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  Field,
  Input,
  Panel,
  Spinner,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export default function PendingPage() {
  const { data, isLoading } = usePending();
  const sheet = useExpenseSheet();
  const [settling, setSettling] = React.useState<ExpenseRow | null>(null);

  const total =
    (data?.reimbursementOutstandingPaise ?? 0) +
    (data?.refundPendingPaise ?? 0) +
    (data?.lendingOutstandingPaise ?? 0);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[1.375rem] font-semibold tracking-[-0.025em]">
          Money owed
        </h1>
        <p className="hint mt-0.5">
          Everything you are waiting to get back — reimbursements, refunds in flight
          and money you have lent.
        </p>
      </header>

      <div className="panel p-5">
        <p className="text-[0.8125rem] text-ink-2">Coming back to you</p>
        <p className="figure mt-1.5 text-[1.625rem] leading-none sm:text-[2rem]">
          {formatMoney(total)}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip tone="warn">
            {formatMoney(data?.reimbursementOutstandingPaise ?? 0)} reimbursements
          </Chip>
          <Chip tone="accent">
            {formatMoney(data?.refundPendingPaise ?? 0)} refunds
          </Chip>
          <Chip tone="neutral">
            {formatMoney(data?.lendingOutstandingPaise ?? 0)} lent out
          </Chip>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-5" />
        </div>
      ) : (
        <>
          <Panel
            title="Reimbursements"
            subtitle="Expenses you paid for that somebody else owes you"
            bodyClassName="p-0"
          >
            {!data || data.reimbursements.length === 0 ? (
              <EmptyState
                icon={<Hourglass className="size-5" />}
                title="Nothing outstanding"
                body="Mark an expense as reimbursable when you pay for something on someone else's behalf."
              />
            ) : (
              <ul className="divide-y divide-rule">
                {data.reimbursements.map((row) => {
                  const overdue =
                    row.expense.reimbursementDueDate &&
                    row.expense.reimbursementDueDate < todayISO();
                  return (
                    <li
                      key={row.expense.id}
                      className="row-hover flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:px-4"
                    >
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => sheet.openEdit(row.expense.id)}
                          className="truncate text-left text-[0.875rem] font-medium hover:underline"
                        >
                          {row.expense.description ||
                            row.expense.merchantName ||
                            "Expense"}
                        </button>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.75rem] text-ink-3">
                          <span className="tnum">
                            {formatDate(row.expense.occurredAt)}
                          </span>
                          {row.expense.reimbursementFrom && (
                            <>
                              <span aria-hidden>·</span>
                              <span>from {row.expense.reimbursementFrom}</span>
                            </>
                          )}
                          {row.expense.reimbursementDueDate && (
                            <>
                              <span aria-hidden>·</span>
                              <span className={cn(overdue && "font-medium text-warn")}>
                                {overdue ? "was due" : "due"}{" "}
                                {formatDate(row.expense.reimbursementDueDate)}
                              </span>
                            </>
                          )}
                        </p>
                        {row.math.reimbursementReceivedPaise > 0 && (
                          <div className="mt-1.5 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-sunken">
                            <div
                              className="h-full rounded-full bg-gain"
                              style={{
                                width: `${(row.math.reimbursementReceivedPaise / Math.max(1, row.math.reimbursementExpectedPaise)) * 100}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-[0.9375rem] font-semibold text-warn tnum">
                          {formatMoney(row.math.reimbursementOutstandingPaise)}
                        </p>
                        <p className="text-[0.6875rem] text-ink-3 tnum">
                          of {formatMoney(row.math.reimbursementExpectedPaise)}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={() => setSettling(row)}
                      >
                        <CheckCheck className="size-3.5" />
                        Record payment
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            title="Refunds in flight"
            subtitle="Raised but not yet back in your account"
            bodyClassName="p-0"
          >
            {!data || data.refunds.length === 0 ? (
              <EmptyState
                icon={<RotateCcw className="size-5" />}
                title="No refunds pending"
                body="File a refund on any expense and track it here until the money lands."
              />
            ) : (
              <ul className="divide-y divide-rule">
                {data.refunds.map((row) => (
                  <PendingRefundRow key={row.expense.id} row={row} />
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      <SettleDialog row={settling} onClose={() => setSettling(null)} />
      <ExpenseSheet
        open={sheet.open}
        onOpenChange={sheet.setOpen}
        expenseId={sheet.id}
      />
    </div>
  );
}

function PendingRefundRow({ row }: { row: ExpenseRow }) {
  const updateRefund = useUpdateRefund();
  const pending = row.refunds.filter((r) => r.status === "pending");

  return (
    <li className="px-4 py-3">
      <p className="text-[0.875rem] font-medium">
        {row.expense.description || row.expense.merchantName || "Expense"}
      </p>
      <p className="mt-0.5 text-[0.75rem] text-ink-3 tnum">
        {formatDate(row.expense.occurredAt)} · original{" "}
        {formatMoney(row.expense.amountPaise)}
      </p>
      <ul className="mt-2 space-y-1.5">
        {pending.map((refund) => (
          <li key={refund.id} className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <RotateCcw className="size-3.5 shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">
              {refund.reason || "Refund raised"} · {formatDate(refund.refundedAt)}
            </span>
            <span className="shrink-0 text-[0.875rem] font-semibold tnum">
              {formatMoney(refund.amountPaise)}
            </span>
            <Button
              size="sm"
              variant="secondary"
              loading={updateRefund.isPending}
              onClick={() =>
                updateRefund.mutate({ id: refund.id, status: "received" })
              }
            >
              Money is back
            </Button>
          </li>
        ))}
      </ul>
    </li>
  );
}

function SettleDialog({
  row,
  onClose,
}: {
  row: ExpenseRow | null;
  onClose: () => void;
}) {
  const recordReimbursement = useRecordReimbursement();
  const [amount, setAmount] = React.useState("");

  React.useEffect(() => {
    if (row) setAmount(String(row.math.reimbursementOutstandingPaise / 100));
  }, [row]);

  if (!row) return null;

  return (
    <Dialog
      open={!!row}
      onOpenChange={(v) => !v && onClose()}
      title="Record a payment"
      description={`${formatMoney(row.math.reimbursementOutstandingPaise)} is still outstanding on this expense.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={recordReimbursement.isPending}
            disabled={toPaise(amount) <= 0}
            onClick={() => {
              recordReimbursement.mutate(
                {
                  id: row.expense.id,
                  action: "record",
                  amountPaise: toPaise(amount),
                },
                { onSuccess: onClose },
              );
            }}
          >
            Record
          </Button>
        </>
      }
    >
      <Field label="How much came back">
        <Input
          autoFocus
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="tnum"
        />
      </Field>
      <p className="hint mt-2">
        Record a smaller number if only part of it has been settled — the rest stays
        on this list.
      </p>
    </Dialog>
  );
}
