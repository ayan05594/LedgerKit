"use client";

import * as React from "react";
import {
  CreditCard,
  Globe,
  Landmark,
  QrCode,
  Store,
  Trash2,
} from "lucide-react";
import type { Adjustment } from "@/db/schema";
import { formatMoney, toPaise } from "@/lib/money";
import { todayISO } from "@/lib/rewards/periods";
import {
  fetchRewardPreview,
  useAddAdjustment,
  useCreateExpense,
  useCreateMerchant,
  useCreatePaymentApp,
  useDeleteAdjustment,
  useDeleteExpense,
  useExpense,
  useReference,
  useUpdateAdjustment,
  useUpdateExpense,
  type RewardPreview,
} from "@/lib/client-api";
import {
  Button,
  Chip,
  Field,
  Input,
  Segmented,
  Select,
  Sheet,
  Switch,
  Textarea,
} from "@/components/ui/primitives";
import { Combobox } from "@/components/ui/combobox";
import { CategoryPicker } from "./category-picker";
import { RewardPreviewPanel } from "./reward-preview";
import {
  AdjustmentsEditor,
  type DraftAdjustment,
} from "./adjustments-editor";
import { RefundsEditor } from "./refunds-editor";

type Channel = "online" | "offline" | "upi";

interface CardFlag {
  key: string;
  label: string;
  hint?: string;
  default: boolean;
}

function safeFlags(raw: string): Record<string, boolean> {
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

interface FormState {
  occurredAt: string;
  amount: string;
  payerKind: "card" | "account";
  instrumentId: string | null;
  accountId: string | null;
  paymentAppSlug: string | null;
  channel: Channel;
  categorySlug: string;
  customLabel: string;
  merchantSlug: string | null;
  merchantName: string;
  description: string;
  notes: string;
  flags: Record<string, boolean>;
  reimbursable: boolean;
  reimbursementMode: "full" | "partial";
  reimbursementAmount: string;
  reimbursementFrom: string;
  reimbursementDueDate: string;
  reimbursementNote: string;
}

const blank = (): FormState => ({
  occurredAt: todayISO(),
  amount: "",
  payerKind: "card",
  instrumentId: null,
  accountId: null,
  paymentAppSlug: null,
  channel: "online",
  categorySlug: "",
  customLabel: "",
  merchantSlug: null,
  merchantName: "",
  description: "",
  notes: "",
  flags: {},
  reimbursable: false,
  reimbursementMode: "full",
  reimbursementAmount: "",
  reimbursementFrom: "",
  reimbursementDueDate: "",
  reimbursementNote: "",
});

export function ExpenseSheet({
  open,
  onOpenChange,
  expenseId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expenseId?: string | null;
}) {
  const editing = !!expenseId;
  const { data: reference } = useReference();
  const { data: existing } = useExpense(open && expenseId ? expenseId : null);

  const [form, setForm] = React.useState<FormState>(blank);
  const [draftAdjustments, setDraftAdjustments] = React.useState<DraftAdjustment[]>([]);
  const [preview, setPreview] = React.useState<RewardPreview | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const addAdjustment = useAddAdjustment();
  const updateAdjustment = useUpdateAdjustment();
  const deleteAdjustment = useDeleteAdjustment();
  const createMerchant = useCreateMerchant();
  const createApp = useCreatePaymentApp();

  const set = React.useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) =>
      setForm((f) => ({ ...f, [key]: value })),
    [],
  );

  /* --------------------------------------------------------- load / reset */

  React.useEffect(() => {
    if (!open) return;
    if (!editing) {
      setForm(blank());
      setDraftAdjustments([]);
      setPreview(null);
      setError(null);
    }
  }, [open, editing]);

  React.useEffect(() => {
    if (!open || !editing || !existing) return;
    const e = existing.expense;
    setForm({
      occurredAt: e.occurredAt,
      amount: String(e.amountPaise / 100),
      payerKind: e.instrumentId ? "card" : "account",
      instrumentId: e.instrumentId,
      accountId: e.accountId,
      paymentAppSlug: e.paymentAppSlug,
      channel: e.channel,
      categorySlug: e.categorySlug,
      customLabel: e.customLabel,
      merchantSlug: e.merchantSlug,
      merchantName: e.merchantName,
      description: e.description,
      notes: e.notes,
      flags: safeFlags(e.flags),
      reimbursable: e.reimbursable,
      reimbursementMode:
        e.reimbursementExpectedPaise >= e.amountPaise ? "full" : "partial",
      reimbursementAmount: String(e.reimbursementExpectedPaise / 100),
      reimbursementFrom: e.reimbursementFrom,
      reimbursementDueDate: e.reimbursementDueDate ?? "",
      reimbursementNote: e.reimbursementNote,
    });
    setDraftAdjustments(
      existing.adjustments.map((a) => ({
        id: a.id,
        label: a.label,
        kind: a.kind,
        amountPaise: a.amountPaise,
        immediate: a.immediate,
        status: a.status,
      })),
    );
  }, [open, editing, existing]);

  /* ------------------------------------------------------- reward preview */

  const amountPaise = toPaise(form.amount);
  const previewKey = [
    form.instrumentId,
    amountPaise,
    form.occurredAt,
    form.categorySlug,
    form.merchantSlug,
    form.paymentAppSlug,
    form.channel,
    JSON.stringify(form.flags),
  ].join("|");

  React.useEffect(() => {
    if (!open) return;
    if (!form.instrumentId || amountPaise <= 0 || !form.categorySlug) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewing(true);
    const timer = setTimeout(async () => {
      try {
        const result = await fetchRewardPreview({
          instrumentId: form.instrumentId!,
          amountPaise,
          occurredAt: form.occurredAt,
          categorySlug: form.categorySlug,
          merchantSlug: form.merchantSlug,
          paymentAppSlug: form.paymentAppSlug,
          channel: form.channel,
          flags: form.flags,
          excludeExpenseId: expenseId ?? undefined,
        });
        if (!cancelled) setPreview(result);
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, previewKey]);

  /* ------------------------------------------------------------ derived */

  const categories = reference?.categories ?? [];
  const selectedCategory = categories.find((c) => c.slug === form.categorySlug);
  const needsLabel = !!selectedCategory?.requiresLabel;

  const selectedCard = reference?.instruments.find((i) => i.id === form.instrumentId);

  const cardFlags = React.useMemo<CardFlag[]>(() => {
    if (!selectedCard) return [];
    try {
      const options = JSON.parse(selectedCard.options) as { flags?: CardFlag[] };
      return Array.isArray(options.flags) ? options.flags : [];
    } catch {
      return [];
    }
  }, [selectedCard]);

  // Pre-fill each answer from the card's own default the first time it applies.
  React.useEffect(() => {
    if (!cardFlags.length) return;
    setForm((f) => {
      const next = { ...f.flags };
      let changed = false;
      for (const flag of cardFlags) {
        if (typeof next[flag.key] !== "boolean") {
          next[flag.key] = !!flag.default;
          changed = true;
        }
      }
      return changed ? { ...f, flags: next } : f;
    });
  }, [cardFlags]);
  const cardExcluded = React.useMemo(() => {
    if (!selectedCard) return false;
    try {
      return (JSON.parse(selectedCard.excludedCategories) as string[]).includes(
        form.categorySlug,
      );
    } catch {
      return false;
    }
  }, [selectedCard, form.categorySlug]);

  const reimbursementPaise =
    form.reimbursementMode === "full"
      ? amountPaise
      : toPaise(form.reimbursementAmount);

  const canSave =
    amountPaise > 0 &&
    !!form.categorySlug &&
    (form.payerKind === "card" ? !!form.instrumentId : !!form.accountId) &&
    (!needsLabel || form.customLabel.trim().length > 0) &&
    (!form.reimbursable || (reimbursementPaise > 0 && reimbursementPaise <= amountPaise));

  /* -------------------------------------------------------------- saving */

  function payload() {
    return {
      occurredAt: form.occurredAt,
      amountPaise,
      description: form.description.trim(),
      instrumentId: form.payerKind === "card" ? form.instrumentId : null,
      accountId: form.payerKind === "account" ? form.accountId : null,
      paymentAppSlug: form.paymentAppSlug,
      categorySlug: form.categorySlug,
      customLabel: form.customLabel.trim(),
      merchantSlug: form.merchantSlug,
      merchantName: form.merchantName.trim(),
      channel: form.channel,
      flags: form.flags,
      notes: form.notes.trim(),
      reimbursable: form.reimbursable,
      reimbursementExpectedPaise: form.reimbursable ? reimbursementPaise : 0,
      reimbursementFrom: form.reimbursementFrom.trim(),
      reimbursementDueDate: form.reimbursementDueDate || null,
      reimbursementNote: form.reimbursementNote.trim(),
    };
  }

  async function save() {
    setError(null);
    if (!canSave) {
      setError("Fill in the amount, category and where it was paid from.");
      return;
    }
    if (editing && expenseId) {
      await updateExpense.mutateAsync({ id: expenseId, ...payload() });
      onOpenChange(false);
      return;
    }
    const created = await createExpense.mutateAsync(payload());
    for (const draft of draftAdjustments) {
      await addAdjustment.mutateAsync({
        expenseId: created.id,
        label: draft.label,
        kind: draft.kind,
        amountPaise: draft.amountPaise,
        immediate: draft.immediate,
        status: draft.status,
      });
    }
    onOpenChange(false);
  }

  /* ------------------------------------------------------- adjustment ops */

  function handleAddAdjustment(draft: DraftAdjustment) {
    if (editing && expenseId) {
      addAdjustment.mutate({ expenseId, ...draft });
    } else {
      setDraftAdjustments((list) => [...list, draft]);
    }
  }

  function handleUpdateAdjustment(index: number, draft: DraftAdjustment) {
    const target = draftAdjustments[index];
    if (editing && target?.id) {
      updateAdjustment.mutate({ id: target.id, ...draft });
    } else {
      setDraftAdjustments((list) =>
        list.map((item, i) => (i === index ? draft : item)),
      );
    }
  }

  function handleRemoveAdjustment(index: number) {
    const target = draftAdjustments[index];
    if (editing && target?.id) {
      deleteAdjustment.mutate(target.id);
    } else {
      setDraftAdjustments((list) => list.filter((_, i) => i !== index));
    }
  }

  const liveAdjustments: DraftAdjustment[] =
    editing && existing
      ? existing.adjustments.map((a: Adjustment) => ({
          id: a.id,
          label: a.label,
          kind: a.kind,
          amountPaise: a.amountPaise,
          immediate: a.immediate,
          status: a.status,
        }))
      : draftAdjustments;

  const instantDiscount = liveAdjustments
    .filter((a) => a.immediate && !["fee", "surcharge", "other"].includes(a.kind))
    .reduce((s, a) => s + a.amountPaise, 0);
  const fees = liveAdjustments
    .filter((a) => ["fee", "surcharge"].includes(a.kind))
    .reduce((s, a) => s + a.amountPaise, 0);
  const outOfPocket = Math.max(0, amountPaise - instantDiscount + fees);

  /* ----------------------------------------------------------------- UI */

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      width="620px"
      title={editing ? "Edit expense" : "Add an expense"}
      description={
        editing
          ? "Change anything here and the rewards recalculate straight away."
          : "Rewards are worked out live as you fill this in."
      }
      footer={
        <>
          {editing && expenseId && (
            <Button
              variant="danger"
              className="order-last basis-full sm:order-none sm:mr-auto sm:basis-auto"
              onClick={() => {
                deleteExpense.mutate(expenseId);
                onOpenChange(false);
              }}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={save}
            loading={createExpense.isPending || updateExpense.isPending}
            disabled={!canSave}
          >
            {editing ? "Save changes" : "Add expense"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <p className="rounded-[9px] border border-alert/25 bg-alert-soft px-3 py-2 text-[0.8125rem] text-alert">
            {error}
          </p>
        )}

        {/* ---- amount and date ---- */}
        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
          <Field label="Amount" required>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[1.0625rem] text-ink-3">
                ₹
              </span>
              <Input
                autoFocus={!editing}
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
                className="tnum pl-7 text-[1.0625rem] font-semibold"
              />
            </div>
          </Field>
          <Field label="Date" required>
            <Input
              type="date"
              value={form.occurredAt}
              onChange={(e) => set("occurredAt", e.target.value)}
            />
          </Field>
        </div>

        {/* ---- paid from ---- */}
        <div>
          <label className="field-label">Paid from</label>
          <Segmented
            fullWidth
            className="mb-2"
            value={form.payerKind}
            onChange={(v) => {
              set("payerKind", v);
              if (v === "card") set("accountId", null);
              else set("instrumentId", null);
            }}
            options={[
              { value: "card", label: "Card", icon: <CreditCard className="size-3.5" /> },
              {
                value: "account",
                label: "Bank account or UPI",
                icon: <Landmark className="size-3.5" />,
              },
            ]}
          />
          {form.payerKind === "card" ? (
            <Combobox
              placeholder="Which card?"
              value={form.instrumentId}
              onChange={(v) => set("instrumentId", v)}
              options={(reference?.instruments ?? []).map((i) => ({
                value: i.id,
                label: i.shortName,
                hint: i.kind === "credit" ? "credit" : "debit",
                color: i.colorFrom,
              }))}
            />
          ) : (
            <Combobox
              placeholder="Which account?"
              value={form.accountId}
              onChange={(v) => set("accountId", v)}
              options={(reference?.accounts ?? []).map((a) => ({
                value: a.id,
                label: a.name,
                hint: a.kind,
                color: a.colorHex,
              }))}
            />
          )}
        </div>

        {/* ---- how it was paid ---- */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Paid through" hint="Matters for SmartBuy, PayZapp and UPI rules">
            <Combobox
              placeholder="App or method"
              allowClear
              clearLabel="Not recorded"
              value={form.paymentAppSlug}
              onChange={(v) => {
                set("paymentAppSlug", v);
                const app = reference?.apps.find((a) => a.slug === v);
                if (app?.kind === "upi") set("channel", "upi");
              }}
              onCreate={async (label) => {
                const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                await createApp.mutateAsync({ name: label, slug });
                set("paymentAppSlug", slug);
              }}
              createLabel="Add app"
              options={(reference?.apps ?? []).map((a) => ({
                value: a.slug,
                label: a.name,
                color: a.colorHex,
                group:
                  a.kind === "upi"
                    ? "UPI"
                    : a.kind === "card"
                      ? "Card"
                      : a.kind === "wallet"
                        ? "Wallets"
                        : "Other",
              }))}
            />
          </Field>
          <Field label="Where">
            <Segmented
              fullWidth
              value={form.channel}
              onChange={(v) => set("channel", v)}
              options={[
                { value: "online", label: "Online", icon: <Globe className="size-3.5" /> },
                { value: "offline", label: "In store", icon: <Store className="size-3.5" /> },
                { value: "upi", label: "UPI", icon: <QrCode className="size-3.5" /> },
              ]}
            />
          </Field>
        </div>

        {/* ---- merchant ---- */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Merchant" hint="Drives merchant-specific reward rates">
            <Combobox
              placeholder="Pick or add a merchant"
              allowClear
              clearLabel="No specific merchant"
              value={form.merchantSlug}
              onChange={(v) => {
                set("merchantSlug", v);
                const m = reference?.merchants.find((x) => x.slug === v);
                if (m) {
                  set("merchantName", m.name);
                  if (!form.categorySlug && m.categorySlug)
                    set("categorySlug", m.categorySlug);
                }
              }}
              onCreate={async (label) => {
                const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                await createMerchant.mutateAsync({
                  name: label,
                  slug,
                  categorySlug: form.categorySlug || null,
                });
                set("merchantSlug", slug);
                set("merchantName", label);
              }}
              createLabel="Add merchant"
              options={(reference?.merchants ?? []).map((m) => ({
                value: m.slug,
                label: m.name,
                color: m.colorHex,
              }))}
            />
          </Field>
          <Field label="Description" hint="What was it for?">
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>

        {/* ---- category ---- */}
        <div>
          <label className="field-label">
            Category <span className="text-alert">*</span>
          </label>
          <CategoryPicker
            categories={categories}
            value={form.categorySlug}
            onChange={(slug) => set("categorySlug", slug)}
          />
          {needsLabel && (
            <div className="mt-2">
              <Field
                label="What was this, exactly?"
                required
                hint="Named so you can find it again later"
              >
                <Input
                  value={form.customLabel}
                  onChange={(e) => set("customLabel", e.target.value)}
                  placeholder="e.g. Passport renewal fee"
                />
              </Field>
            </div>
          )}
          {cardExcluded && (
            <p className="mt-2 rounded-[9px] border border-warn/25 bg-warn-soft px-3 py-2 text-[0.8125rem] text-warn">
              {selectedCard?.shortName} pays no reward on this category. Another card
              might.
            </p>
          )}
        </div>

        {/* ---- card conditions, e.g. Prime membership ---- */}
        {form.payerKind === "card" && cardFlags.length > 0 && (
          <div className="space-y-2">
            {cardFlags.map((flag) => (
              <div
                key={flag.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[11px] border border-rule-strong px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[0.875rem] font-medium">{flag.label}?</p>
                  {flag.hint && <p className="hint mt-0.5">{flag.hint}</p>}
                </div>
                <Segmented
                  value={form.flags[flag.key] ? "yes" : "no"}
                  onChange={(v) =>
                    set("flags", { ...form.flags, [flag.key]: v === "yes" })
                  }
                  options={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                />
              </div>
            ))}
          </div>
        )}

        {/* ---- live reward ---- */}
        {form.payerKind === "card" && (
          <RewardPreviewPanel
            preview={preview}
            loading={previewing}
            cardName={selectedCard?.shortName ?? ""}
          />
        )}

        {/* ---- extra discounts ---- */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <label className="field-label mb-0">Extra discounts and fees</label>
            {(instantDiscount > 0 || fees > 0) && (
              <span className="text-[0.75rem] text-ink-2 tnum">
                You actually paid {formatMoney(outOfPocket)}
              </span>
            )}
          </div>
          <AdjustmentsEditor
            items={liveAdjustments}
            onAdd={handleAddAdjustment}
            onUpdate={handleUpdateAdjustment}
            onRemove={handleRemoveAdjustment}
          />
        </div>

        {/* ---- reimbursement ---- */}
        <div className="rounded-[11px] border border-rule-strong">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div>
              <p className="text-[0.875rem] font-medium">Someone owes me for this</p>
              <p className="hint mt-0.5">
                Keeps it out of your real spend until it comes back
              </p>
            </div>
            <Switch
              checked={form.reimbursable}
              onCheckedChange={(v) => {
                set("reimbursable", v);
                if (v && !form.reimbursementAmount)
                  set("reimbursementAmount", form.amount);
              }}
            />
          </div>

          {form.reimbursable && (
            <div className="space-y-3 border-t border-rule bg-paper p-3">
              <Segmented
                fullWidth
                value={form.reimbursementMode}
                onChange={(v) => set("reimbursementMode", v)}
                options={[
                  { value: "full", label: "The whole amount" },
                  { value: "partial", label: "Part of it" },
                ]}
              />
              {form.reimbursementMode === "partial" && (
                <Field
                  label="How much is coming back"
                  hint={
                    amountPaise > 0 && reimbursementPaise > 0
                      ? `Leaves ${formatMoney(Math.max(0, amountPaise - reimbursementPaise))} as your own spend`
                      : undefined
                  }
                >
                  <Input
                    inputMode="decimal"
                    value={form.reimbursementAmount}
                    onChange={(e) => set("reimbursementAmount", e.target.value)}
                    placeholder="0.00"
                    className="tnum"
                  />
                </Field>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="From whom">
                  <Input
                    value={form.reimbursementFrom}
                    onChange={(e) => set("reimbursementFrom", e.target.value)}
                    placeholder="Work, Rohan, family…"
                  />
                </Field>
                <Field label="Expected by">
                  <Input
                    type="date"
                    value={form.reimbursementDueDate}
                    onChange={(e) => set("reimbursementDueDate", e.target.value)}
                  />
                </Field>
              </div>
              {editing && existing && existing.expense.reimbursementReceivedPaise > 0 && (
                <p className="text-[0.8125rem] text-gain">
                  {formatMoney(existing.expense.reimbursementReceivedPaise)} already
                  received. Record more from the Money owed page.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ---- refunds, once the expense exists ---- */}
        {editing && expenseId && existing && (
          <div>
            <label className="field-label">Refunds</label>
            <RefundsEditor
              expenseId={expenseId}
              expenseAmountPaise={existing.expense.amountPaise}
              refunds={existing.refunds}
            />
          </div>
        )}

        {/* ---- notes ---- */}
        <Field label="Notes">
          <Textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Anything you want to remember about this one"
          />
        </Field>

        {!editing && (
          <p className="hint">
            Refunds can be filed once the expense is saved.
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** Small helper used by list rows to open the sheet in edit mode. */
export function useExpenseSheet() {
  const [state, setState] = React.useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  return {
    ...state,
    openNew: () => setState({ open: true, id: null }),
    openEdit: (id: string) => setState({ open: true, id }),
    close: () => setState({ open: false, id: null }),
    setOpen: (v: boolean) => setState((s) => ({ ...s, open: v })),
  };
}

export function ChannelChip({ channel }: { channel: Channel }) {
  const map = {
    online: { label: "Online", icon: <Globe className="size-3" /> },
    offline: { label: "In store", icon: <Store className="size-3" /> },
    upi: { label: "UPI", icon: <QrCode className="size-3" /> },
  } as const;
  return (
    <Chip tone="neutral">
      {map[channel].icon}
      {map[channel].label}
    </Chip>
  );
}
