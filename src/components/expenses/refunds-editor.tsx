"use client";

import * as React from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import type { Refund } from "@/db/schema";
import { formatMoney, toPaise } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/rewards/periods";
import {
  useAddRefund,
  useDeleteRefund,
  useUpdateRefund,
} from "@/lib/client-api";
import { Button, Chip, Field, Input, Select } from "@/components/ui/primitives";

export function RefundsEditor({
  expenseId,
  expenseAmountPaise,
  refunds,
}: {
  expenseId: string;
  expenseAmountPaise: number;
  refunds: Refund[];
}) {
  const formId = React.useId();
  const [adding, setAdding] = React.useState(false);
  const addRefund = useAddRefund();
  const updateRefund = useUpdateRefund();
  const deleteRefund = useDeleteRefund();

  const alreadyRefunded = refunds.reduce((s, r) => s + r.amountPaise, 0);
  const remaining = Math.max(0, expenseAmountPaise - alreadyRefunded);

  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [status, setStatus] = React.useState<"pending" | "received">("received");
  const [date, setDate] = React.useState(todayISO());

  function reset() {
    setAmount("");
    setReason("");
    setStatus("received");
    setDate(todayISO());
    setAdding(false);
  }

  return (
    <div className="space-y-2">
      {refunds.length > 0 && (
        <ul className="divide-y divide-rule overflow-hidden rounded-[11px] border border-rule">
          {refunds.map((refund) => (
            <li
              key={refund.id}
              className="row-hover flex items-center gap-3 px-3 py-2.5"
            >
              <RotateCcw className="size-3.5 shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8438rem] font-medium">
                  {refund.reason || "Refund"}
                </p>
                <p className="mt-0.5 text-[0.75rem] text-ink-3">
                  {formatDate(refund.refundedAt)}
                </p>
              </div>
              <Chip tone={refund.status === "received" ? "gain" : "warn"}>
                {refund.status === "received" ? "Back in account" : "Still waiting"}
              </Chip>
              <span className="shrink-0 text-[0.875rem] font-semibold text-gain tnum">
                {formatMoney(refund.amountPaise)}
              </span>
              <div className="flex shrink-0 gap-0.5">
                {refund.status === "pending" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      updateRefund.mutate({ id: refund.id, status: "received" })
                    }
                  >
                    Mark received
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove refund"
                  onClick={() => deleteRefund.mutate(refund.id)}
                >
                  <Trash2 className="size-3.5 text-alert" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="space-y-2.5 rounded-[11px] border border-rule bg-paper p-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field
              label="Refund amount"
              htmlFor={`${formId}-amount`}
              hint={`Up to ${formatMoney(remaining)} left on this expense`}
            >
              <Input
                id={`${formId}-amount`}
                name="refundAmount"
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="tnum"
              />
            </Field>
            <Field label="Refunded on" htmlFor={`${formId}-date`}>
              <Input
                id={`${formId}-date`}
                name="refundedAt"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Reason" htmlFor={`${formId}-reason`}>
              <Input
                id={`${formId}-reason`}
                name="refundReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Returned, cancelled, price drop…"
              />
            </Field>
            <Field label="Status" htmlFor={`${formId}-status`}>
              <Select
                id={`${formId}-status`}
                name="refundStatus"
                value={status}
                onChange={(e) => setStatus(e.target.value as "pending" | "received")}
              >
                <option value="received">Money is back</option>
                <option value="pending">Raised, still waiting</option>
              </Select>
            </Field>
          </div>
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAmount(String(remaining / 100))}
            >
              Refund the full remaining amount
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={reset}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                loading={addRefund.isPending}
                disabled={toPaise(amount) <= 0}
                onClick={() =>
                  addRefund.mutate(
                    {
                      expenseId,
                      amountPaise: toPaise(amount),
                      refundedAt: date,
                      status,
                      reason: reason.trim(),
                    },
                    { onSuccess: reset },
                  )
                }
              >
                File refund
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setAdding(true)}
          disabled={remaining <= 0}
        >
          <Plus className="size-3.5" />
          {remaining <= 0 ? "Fully refunded" : "File a refund"}
        </Button>
      )}
    </div>
  );
}
