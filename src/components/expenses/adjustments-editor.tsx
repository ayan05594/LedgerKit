"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Adjustment } from "@/db/schema";
import { formatMoney, toPaise } from "@/lib/money";
import { isBenefit } from "@/lib/derive";
import { Button, Chip, Field, Input, Select } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export interface DraftAdjustment {
  id?: string;
  label: string;
  kind: Adjustment["kind"];
  amountPaise: number;
  immediate: boolean;
  status: "expected" | "received";
}

export const ADJUSTMENT_KINDS: { value: Adjustment["kind"]; label: string }[] = [
  { value: "instant_discount", label: "Instant discount" },
  { value: "coupon", label: "Coupon" },
  { value: "bank_offer", label: "Bank offer" },
  { value: "cashback", label: "Cashback (arrives later)" },
  { value: "reward_points", label: "Reward points" },
  { value: "gift_card", label: "Gift card or voucher" },
  { value: "fee", label: "Fee" },
  { value: "surcharge", label: "Surcharge" },
  { value: "other", label: "Other" },
];

export function kindLabel(kind: Adjustment["kind"]) {
  return ADJUSTMENT_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export function AdjustmentsEditor({
  items,
  onAdd,
  onUpdate,
  onRemove,
  busy,
}: {
  items: DraftAdjustment[];
  onAdd: (draft: DraftAdjustment) => void;
  onUpdate: (index: number, draft: DraftAdjustment) => void;
  onRemove: (index: number) => void;
  busy?: boolean;
}) {
  const [editing, setEditing] = React.useState<number | "new" | null>(null);

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="divide-y divide-rule overflow-hidden rounded-[11px] border border-rule">
          {items.map((item, index) =>
            editing === index ? (
              <li key={item.id ?? index} className="bg-paper p-3">
                <AdjustmentForm
                  initial={item}
                  onCancel={() => setEditing(null)}
                  onSubmit={(draft) => {
                    onUpdate(index, draft);
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li
                key={item.id ?? index}
                className="row-hover flex items-center gap-3 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8438rem] font-medium">{item.label}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Chip tone="neutral">{kindLabel(item.kind)}</Chip>
                    {!item.immediate && (
                      <Chip tone={item.status === "received" ? "gain" : "warn"}>
                        {item.status === "received" ? "Received" : "Expected"}
                      </Chip>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[0.875rem] font-semibold tnum",
                    isBenefit(item.kind) ? "text-gain" : "text-alert",
                  )}
                >
                  {isBenefit(item.kind) ? "−" : "+"}
                  {formatMoney(item.amountPaise)}
                </span>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${item.label}`}
                    onClick={() => setEditing(index)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${item.label}`}
                    disabled={busy}
                    onClick={() => onRemove(index)}
                  >
                    <Trash2 className="size-3.5 text-alert" />
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {editing === "new" ? (
        <div className="rounded-[11px] border border-rule bg-paper p-3">
          <AdjustmentForm
            onCancel={() => setEditing(null)}
            onSubmit={(draft) => {
              onAdd(draft);
              setEditing(null);
            }}
          />
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-3.5" />
          Add a discount, offer or fee
        </Button>
      )}
    </div>
  );
}

function AdjustmentForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: DraftAdjustment;
  onSubmit: (draft: DraftAdjustment) => void;
  onCancel: () => void;
}) {
  const formId = React.useId();
  const [label, setLabel] = React.useState(initial?.label ?? "");
  const [kind, setKind] = React.useState<Adjustment["kind"]>(
    initial?.kind ?? "instant_discount",
  );
  const [amount, setAmount] = React.useState(
    initial ? String(initial.amountPaise / 100) : "",
  );
  const [immediate, setImmediate] = React.useState(initial?.immediate ?? true);
  const [status, setStatus] = React.useState<"expected" | "received">(
    initial?.status ?? "received",
  );

  const amountPaise = toPaise(amount);
  const valid = label.trim().length > 0 && amountPaise > 0;

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="What is it" htmlFor={`${formId}-label`}>
          <Input
            id={`${formId}-label`}
            name="adjustmentLabel"
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. HDFC 10% instant discount"
          />
        </Field>
        <Field label="Amount" htmlFor={`${formId}-amount`}>
          <Input
            id={`${formId}-amount`}
            name="adjustmentAmount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="tnum"
          />
        </Field>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Type" htmlFor={`${formId}-kind`}>
          <Select
            id={`${formId}-kind`}
            name="adjustmentKind"
            value={kind}
            onChange={(e) => {
              const next = e.target.value as Adjustment["kind"];
              setKind(next);
              if (next === "cashback" || next === "reward_points") setImmediate(false);
            }}
          >
            {ADJUSTMENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="When it applies" htmlFor={`${formId}-timing`}>
          <Select
            id={`${formId}-timing`}
            name="adjustmentTiming"
            value={immediate ? "immediate" : status}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "immediate") setImmediate(true);
              else {
                setImmediate(false);
                setStatus(v as "expected" | "received");
              }
            }}
          >
            <option value="immediate">Came off at checkout</option>
            <option value="expected">Arrives later — not yet in</option>
            <option value="received">Arrived later — already in</option>
          </Select>
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-0.5">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!valid}
          onClick={() =>
            onSubmit({
              id: initial?.id,
              label: label.trim(),
              kind,
              amountPaise,
              immediate,
              status,
            })
          }
        >
          {initial ? "Save" : "Add"}
        </Button>
      </div>
    </div>
  );
}
