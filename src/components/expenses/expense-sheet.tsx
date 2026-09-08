"use client";

import * as React from "react";
import Link from "next/link";
import {
  CreditCard,
  Globe,
  Landmark,
  QrCode,
  RefreshCw,
  Store,
  Trash2,
  TriangleAlert,
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
  rewardOverrideAmount: string;
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
  rewardOverrideAmount: "",
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
  const formId = React.useId();
  const {
    data: reference,
    error: referenceError,
    isLoading: referenceLoading,
    isFetching: referenceFetching,
    refetch: refetchReference,
  } = useReference(open);
  const { data: existing } = useExpense(open && expenseId ? expenseId : null);
  const availableInstruments = React.useMemo(() => {
    const cards = [...(reference?.instruments ?? [])];
    if (
      existing?.instrument &&
      !cards.some((card) => card.id === existing.instrument?.id)
    ) {
      cards.unshift(existing.instrument);
    }
    return cards;
  }, [existing?.instrument, reference?.instruments]);
  const canUseCard = availableInstruments.length > 0;

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
      rewardOverrideAmount:
        e.rewardOverridePaise == null ? "" : String(e.rewardOverridePaise / 100),
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

  React.useEffect(() => {
    if (!open || editing || !reference || reference.instruments.length > 0) return;
    setForm((current) => {
      if (current.payerKind !== "card") return current;
      return {
        ...current,
        payerKind: "account",
        instrumentId: null,
        accountId: current.accountId ?? reference.accounts[0]?.id ?? null,
      };
    });
  }, [editing, open, reference]);

  /* ------------------------------------------------------- reward preview */

  const amountPaise = toPaise(form.amount);
  const selectedCard = availableInstruments.find((i) => i.id === form.instrumentId);
  const rewardIsCalculable =
    selectedCard?.rewardCoverage === "exact" ||
    selectedCard?.rewardCoverage === "partial";
  const rewardIsEstimate = selectedCard?.rewardCoverage === "partial";
  const usesManualReward =
    form.payerKind === "card" && selectedCard?.rewardCoverage === "manual";
  const rewardOverrideRaw = form.rewardOverrideAmount.trim();
  const rewardOverridePaise =
    usesManualReward && rewardOverrideRaw !== ""
      ? toPaise(rewardOverrideRaw)
      : null;
  const rewardOverrideValid =
    !usesManualReward ||
    rewardOverrideRaw === "" ||
    (Number.isFinite(Number(rewardOverrideRaw)) && Number(rewardOverrideRaw) >= 0);
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
    if (
      !form.instrumentId ||
      !rewardIsCalculable ||
      amountPaise <= 0 ||
      !form.categorySlug
    ) {
      setPreview(null);
      setPreviewing(false);
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
  }, [open, previewKey, rewardIsCalculable]);

  /* ------------------------------------------------------------ derived */

  const categories = reference?.categories ?? [];
  const selectedCategory = categories.find((c) => c.slug === form.categorySlug);
  const needsLabel = !!selectedCategory?.requiresLabel;

  const cardFlags = React.useMemo<CardFlag[]>(() => {
    if (!selectedCard || !rewardIsCalculable) return [];
    try {
      const options = JSON.parse(selectedCard.options) as { flags?: CardFlag[] };
      return Array.isArray(options.flags) ? options.flags : [];
    } catch {
      return [];
    }
  }, [selectedCard, rewardIsCalculable]);

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
    if (!selectedCard || !rewardIsCalculable) return false;
    try {
      return (JSON.parse(selectedCard.excludedCategories) as string[]).includes(
        form.categorySlug,
      );
    } catch {
      return false;
    }
  }, [selectedCard, rewardIsCalculable, form.categorySlug]);

  const reimbursementPaise =
    form.reimbursementMode === "full"
      ? amountPaise
      : toPaise(form.reimbursementAmount);

  const canSave =
    amountPaise > 0 &&
    !!form.categorySlug &&
    (form.payerKind === "card" ? !!form.instrumentId : !!form.accountId) &&
    (!needsLabel || form.customLabel.trim().length > 0) &&
    rewardOverrideValid &&
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
      rewardOverridePaise,
    };
  }

  async function save() {
    setError(null);
    if (!canSave) {
      setError("Fill in the amount, category and where it was paid from.");
      return;
    }
    try {
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
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The expense could not be saved. Please try again.",
      );
    }
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
        usesManualReward
          ? editing
            ? "Update the purchase and any reward confirmed on your issuer statement."
            : "Log the purchase now, then record its reward once your issuer confirms it."
          : rewardIsCalculable
          ? rewardIsEstimate
            ? editing
              ? "Changes recalculate a partial-coverage reward estimate. Confirm it against your statement."
              : "LedgerKit estimates this card's reward from partial coverage as you fill this in."
            : editing
              ? "Change anything here and the reward recalculates straight away."
              : "This card's reward is worked out live as you fill this in."
          : editing
            ? "Update the purchase details. Statement-tracked rewards are not recalculated."
            : "Log the purchase details. Supported card reward estimates update live when available."
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
        {referenceError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-[10px] border border-alert/25 bg-alert-soft px-3 py-3 text-alert"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] font-medium">
                Cards and categories could not be loaded
              </p>
              <p className="mt-0.5 text-[0.75rem]">
                {referenceError.message}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              loading={referenceFetching}
              onClick={() => void refetchReference()}
            >
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          </div>
        )}
        {referenceLoading && !referenceError && (
          <p className="rounded-[9px] border border-rule bg-sunken px-3 py-2 text-[0.8125rem] text-ink-2">
            Loading your cards and categories...
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-[9px] border border-alert/25 bg-alert-soft px-3 py-2 text-[0.8125rem] text-alert"
          >
            {error}
          </p>
        )}

        {/* ---- amount and date ---- */}
        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
          <Field label="Amount" htmlFor={`${formId}-amount`} required>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[1.0625rem] text-ink-3">
                ₹
              </span>
              <Input
                id={`${formId}-amount`}
                name="amount"
                autoFocus={!editing}
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
                className="tnum pl-7 text-[1.0625rem] font-semibold"
              />
            </div>
          </Field>
          <Field label="Date" htmlFor={`${formId}-date`} required>
            <Input
              id={`${formId}-date`}
              name="occurredAt"
              type="date"
              value={form.occurredAt}
              onChange={(e) => set("occurredAt", e.target.value)}
            />
          </Field>
        </div>

        {/* ---- paid from ---- */}
        <div>
          <p id={`${formId}-payer-kind-label`} className="field-label">
            Paid from
          </p>
          <Segmented
            fullWidth
            className="mb-2"
            ariaLabelledBy={`${formId}-payer-kind-label`}
            value={form.payerKind}
            onChange={(v) => {
              set("payerKind", v);
              if (v === "card") set("accountId", null);
              else set("instrumentId", null);
            }}
            options={[
              {
                value: "card",
                label: "Card",
                icon: <CreditCard className="size-3.5" />,
                disabled: !canUseCard,
              },
              {
                value: "account",
                label: "Bank account or UPI",
                icon: <Landmark className="size-3.5" />,
              },
            ]}
          />
          {!canUseCard && reference && (
            <p className="mb-2 rounded-[9px] border border-rule bg-paper px-3 py-2 text-[0.75rem] text-ink-2">
              No cards are selected. Use a bank account below or{" "}
              <Link
                href="/settings#my-cards"
                onClick={() => onOpenChange(false)}
                className="font-medium text-accent hover:underline"
              >
                manage your cards
              </Link>
              .
            </p>
          )}
          {form.payerKind === "card" && canUseCard ? (
            <Combobox
              id={`${formId}-instrument`}
              name="instrumentId"
              ariaLabel="Card used for this expense"
              placeholder="Which card?"
              value={form.instrumentId}
              onChange={(v) => set("instrumentId", v)}
              options={availableInstruments.map((i) => ({
                value: i.id,
                label: i.shortName,
                hint: i.kind === "credit" ? "credit" : "debit",
                color: i.colorFrom,
              }))}
            />
          ) : reference && reference.accounts.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-rule-strong bg-paper px-3 py-3 text-[0.8125rem] text-ink-2">
              <p className="font-medium text-ink">No bank account or UPI source yet</p>
              <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-3">
                Add one before logging an expense without a selected credit card.
              </p>
              <Link
                href="/accounts"
                onClick={() => onOpenChange(false)}
                className="mt-2 inline-flex min-h-9 items-center font-semibold text-accent hover:underline"
              >
                Add an account
              </Link>
            </div>
          ) : (
            <Combobox
              id={`${formId}-account`}
              name="accountId"
              ariaLabel="Account used for this expense"
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
          <Field
            label="Paid through"
            htmlFor={`${formId}-payment-app`}
            hint="Matters for SmartBuy, PayZapp and UPI rules"
          >
            <Combobox
              id={`${formId}-payment-app`}
              name="paymentAppSlug"
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
          <div>
            <p id={`${formId}-channel-label`} className="field-label">
              Where
            </p>
            <Segmented
              fullWidth
              ariaLabelledBy={`${formId}-channel-label`}
              value={form.channel}
              onChange={(v) => set("channel", v)}
              options={[
                { value: "online", label: "Online", icon: <Globe className="size-3.5" /> },
                { value: "offline", label: "In store", icon: <Store className="size-3.5" /> },
                { value: "upi", label: "UPI", icon: <QrCode className="size-3.5" /> },
              ]}
            />
          </div>
        </div>

        {/* ---- merchant ---- */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Merchant"
            htmlFor={`${formId}-merchant`}
            hint="Drives merchant-specific reward rates"
          >
            <Combobox
              id={`${formId}-merchant`}
              name="merchantSlug"
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
          <Field
            label="Description"
            htmlFor={`${formId}-description`}
            hint="What was it for?"
          >
            <Input
              id={`${formId}-description`}
              name="description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>

        {/* ---- category ---- */}
        <div>
          <p id={`${formId}-category-label`} className="field-label">
            Category <span className="text-alert">*</span>
          </p>
          <CategoryPicker
            id={`${formId}-category`}
            labelledBy={`${formId}-category-label`}
            categories={categories}
            value={form.categorySlug}
            onChange={(slug) => set("categorySlug", slug)}
          />
          {needsLabel && (
            <div className="mt-2">
              <Field
                label="What was this, exactly?"
                htmlFor={`${formId}-custom-label`}
                required
                hint="Named so you can find it again later"
              >
                <Input
                  id={`${formId}-custom-label`}
                  name="customLabel"
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
                  <p
                    id={`${formId}-flag-${flag.key}`}
                    className="text-[0.875rem] font-medium"
                  >
                    {flag.label}?
                  </p>
                  {flag.hint && <p className="hint mt-0.5">{flag.hint}</p>}
                </div>
                <Segmented
                  ariaLabelledBy={`${formId}-flag-${flag.key}`}
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
            automated={!selectedCard || rewardIsCalculable}
            estimated={rewardIsEstimate}
            officialUrl={selectedCard?.officialUrl || undefined}
          />
        )}

        {/* ---- issuer-confirmed manual reward ---- */}
        {usesManualReward && (
          <div className="space-y-3 rounded-[11px] border border-warn/25 bg-warn-soft p-3">
            <div
              role="note"
              aria-labelledby={`${formId}-manual-reward-title`}
              aria-describedby={`${formId}-manual-reward-guidance`}
              className="flex items-start gap-2.5"
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-warn"
                aria-hidden
              />
              <div className="min-w-0">
                <p
                  id={`${formId}-manual-reward-title`}
                  className="text-[0.8125rem] font-semibold text-ink"
                >
                  Enter issuer-confirmed rewards only
                </p>
                <p
                  id={`${formId}-manual-reward-guidance`}
                  className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-2"
                >
                  Add the final INR value only after the cashback or reward appears
                  in your card issuer's app or statement. Leave this blank while it
                  is pending.
                </p>
                {selectedCard.officialUrl && (
                  <a
                    href={selectedCard.officialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex min-h-7 items-center text-[0.75rem] font-semibold text-accent hover:underline"
                  >
                    Review official card terms
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </div>
            </div>
            <Field
              label="Confirmed reward or cashback (optional)"
              htmlFor={`${formId}-reward-override`}
              error={
                rewardOverrideValid
                  ? undefined
                  : "Enter zero or a positive INR amount."
              }
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[0.9375rem] text-ink-3">
                  ₹
                </span>
                <Input
                  id={`${formId}-reward-override`}
                  name="rewardOverrideAmount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.rewardOverrideAmount}
                  onChange={(event) =>
                    set("rewardOverrideAmount", event.target.value)
                  }
                  placeholder="0.00"
                  aria-describedby={`${formId}-manual-reward-guidance`}
                  className="tnum pl-7"
                />
              </div>
            </Field>
          </div>
        )}

        {/* ---- extra discounts ---- */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="field-label mb-0">Extra discounts and fees</p>
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
            <label htmlFor={`${formId}-reimbursable`} className="block cursor-pointer">
              <span className="block text-[0.875rem] font-medium">
                Someone owes me for this
              </span>
              <span className="hint mt-0.5 block">
                Keeps it out of your real spend until it comes back
              </span>
            </label>
            <Switch
              id={`${formId}-reimbursable`}
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
                ariaLabel="Reimbursement amount"
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
                  htmlFor={`${formId}-reimbursement-amount`}
                  hint={
                    amountPaise > 0 && reimbursementPaise > 0
                      ? `Leaves ${formatMoney(Math.max(0, amountPaise - reimbursementPaise))} as your own spend`
                      : undefined
                  }
                >
                  <Input
                    id={`${formId}-reimbursement-amount`}
                    name="reimbursementAmount"
                    inputMode="decimal"
                    value={form.reimbursementAmount}
                    onChange={(e) => set("reimbursementAmount", e.target.value)}
                    placeholder="0.00"
                    className="tnum"
                  />
                </Field>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="From whom" htmlFor={`${formId}-reimbursement-from`}>
                  <Input
                    id={`${formId}-reimbursement-from`}
                    name="reimbursementFrom"
                    value={form.reimbursementFrom}
                    onChange={(e) => set("reimbursementFrom", e.target.value)}
                    placeholder="Work, Rohan, family…"
                  />
                </Field>
                <Field label="Expected by" htmlFor={`${formId}-reimbursement-due`}>
                  <Input
                    id={`${formId}-reimbursement-due`}
                    name="reimbursementDueDate"
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
            <p className="field-label">Refunds</p>
            <RefundsEditor
              expenseId={expenseId}
              expenseAmountPaise={existing.expense.amountPaise}
              refunds={existing.refunds}
            />
          </div>
        )}

        {/* ---- notes ---- */}
        <Field label="Notes" htmlFor={`${formId}-notes`}>
          <Textarea
            id={`${formId}-notes`}
            name="notes"
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
