import "server-only";
import { nanoid } from "nanoid";
import type {
  Account,
  Adjustment,
  Expense,
  Refund,
  RewardRule,
  StandaloneReimbursement,
  StandaloneReimbursementReceipt,
  Transfer,
} from "@/db/schema";
import { recomputeForDate, recomputeInstrumentYear } from "@/lib/rewards/recompute";
import { todayISO } from "@/lib/rewards/periods";
import { requireUserId } from "@/lib/auth";
import {
  inferBalanceTreatment,
  type BalanceTreatment,
} from "@/lib/transfers/balance";
import { ApiError } from "@/lib/api";
import { deriveStandaloneReimbursementState } from "@/lib/reimbursements";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fromSupabaseRows, toSupabaseRow } from "@/lib/supabase/rows";
import { requireSelectedCard } from "@/server/card-selection";
import {
  requireAccessibleCategory,
  requireAccessibleMerchant,
  requireAccessiblePaymentApp,
  requireOwnedAccount,
  requireOwnedExpense,
  requireOwnedPerson,
  requireOwnedTransfer,
  validateExpenseOwnershipReferences,
  validateTransferOwnershipReferences,
} from "@/server/ownership";

const id = (p: string) => `${p}_${nanoid(12)}`;
const stamp = () => new Date().toISOString();

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

type OwnedReferenceTable = "categories" | "merchants" | "payment_apps";

/**
 * Slugs are legacy globally-unique keys. Keep familiar system slugs shared,
 * but namespace a custom slug when another tenant already owns the base.
 */
async function allocateOwnedReferenceSlug(
  table: OwnedReferenceTable,
  userId: string,
  rawSlug: string,
) {
  const base = slugify(rawSlug) || "custom";
  const ownerSuffix = userId.replace(/[^a-z0-9]/gi, "").slice(0, 10).toLowerCase();
  const candidates = [base, `${base}-${ownerSuffix || nanoid(8).toLowerCase()}`];
  const admin = createSupabaseAdminClient();

  for (const candidate of candidates) {
    const result = await admin
      .from(table)
      .select("id,is_system,owner_user_id")
      .eq("slug", candidate)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return { slug: candidate, existingId: null as string | null };
    if (
      result.data.is_system === true ||
      result.data.owner_user_id === userId
    ) {
      return { slug: candidate, existingId: String(result.data.id) };
    }
  }

  return {
    slug: `${base}-${ownerSuffix || "user"}-${nanoid(6).toLowerCase()}`,
    existingId: null as string | null,
  };
}

/* -------------------------------------------------------------- expenses */

export interface ExpenseInput {
  occurredAt: string;
  amountPaise: number;
  description?: string;
  instrumentId?: string | null;
  accountId?: string | null;
  paymentAppSlug?: string | null;
  categorySlug: string;
  customLabel?: string;
  merchantSlug?: string | null;
  merchantName?: string;
  channel?: "online" | "offline" | "upi";
  tags?: string[];
  notes?: string;
  flags?: Record<string, boolean>;
  reimbursable?: boolean;
  reimbursementExpectedPaise?: number;
  reimbursementFrom?: string;
  reimbursementDueDate?: string | null;
  reimbursementNote?: string;
  rewardOverridePaise?: number | null;
}

function reimbursementStatusFor(
  reimbursable: boolean,
  expected: number,
  received: number,
): "none" | "pending" | "partial" | "settled" {
  if (!reimbursable || expected <= 0) return "none";
  if (received <= 0) return "pending";
  if (received >= expected) return "settled";
  return "partial";
}

export async function createExpense(input: ExpenseInput) {
  const userId = await requireUserId();
  await Promise.all([
    input.instrumentId
      ? requireSelectedCard(userId, input.instrumentId)
      : Promise.resolve(),
    validateExpenseOwnershipReferences(userId, input),
  ]);
  const rowId = id("exp");
  const reimbursable = !!input.reimbursable;
  const expected = reimbursable ? (input.reimbursementExpectedPaise ?? 0) : 0;
  const admin = createSupabaseAdminClient();
  let rewardCoverage: "exact" | "partial" | "manual" | null = null;
  if (input.instrumentId) {
    const coverageResult = await admin
      .from("instruments")
      .select("reward_coverage")
      .eq("id", input.instrumentId)
      .or(`is_catalog_card.eq.true,owner_user_id.eq.${userId}`)
      .maybeSingle();
    if (coverageResult.error) throw coverageResult.error;
    rewardCoverage = (coverageResult.data?.reward_coverage ?? "manual") as
      | "exact"
      | "partial"
      | "manual";
  }
  const rewardOverridePaise = input.instrumentId
    ? (input.rewardOverridePaise ?? null)
    : null;
  const isManualReward = rewardCoverage === "manual";

  const result = await admin
    .from("expenses")
    .insert(toSupabaseRow({
      id: rowId,
      userId,
      occurredAt: input.occurredAt,
      amountPaise: input.amountPaise,
      description: input.description ?? "",
      instrumentId: input.instrumentId ?? null,
      accountId: input.accountId ?? null,
      paymentAppSlug: input.paymentAppSlug ?? null,
      categorySlug: input.categorySlug,
      customLabel: input.customLabel ?? "",
      merchantSlug: input.merchantSlug ?? null,
      merchantName: input.merchantName ?? "",
      channel: input.channel ?? "online",
      tags: JSON.stringify(input.tags ?? []),
      notes: input.notes ?? "",
      flags: JSON.stringify(input.flags ?? {}),
      reimbursable,
      reimbursementExpectedPaise: expected,
      reimbursementReceivedPaise: 0,
      reimbursementStatus: reimbursementStatusFor(reimbursable, expected, 0),
      reimbursementFrom: input.reimbursementFrom ?? "",
      reimbursementDueDate: input.reimbursementDueDate ?? null,
      reimbursementNote: input.reimbursementNote ?? "",
      rewardOverridePaise,
      rewardRuleId: null,
      rewardUnitsMilli: 0,
      rewardValuePaise:
        isManualReward && rewardOverridePaise != null ? rewardOverridePaise : 0,
      rewardCappedUnitsMilli: 0,
      rewardExplain:
        isManualReward && rewardOverridePaise != null
          ? "Manual reward confirmed from issuer statement."
          : "",
      createdAt: stamp(),
      updatedAt: stamp(),
    }));
  if (result.error) throw result.error;

  await recomputeForDate(input.instrumentId ?? null, input.occurredAt);
  return rowId;
}

export async function updateExpense(rowId: string, input: Partial<ExpenseInput>) {
  const userId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const existingResult = await admin
    .from("expenses")
    .select("*")
    .eq("id", rowId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const [existing] = fromSupabaseRows<Expense>(
    existingResult.data ? [existingResult.data] : [],
  );
  if (!existing) return null;

  // Keep old expenses editable after a card is removed, but never allow an
  // API caller to move an expense onto another user's reference row. Unchanged
  // quarantined legacy references remain editable.
  const referenceChecks: Promise<void>[] = [];
  if (input.instrumentId && input.instrumentId !== existing.instrumentId) {
    referenceChecks.push(requireSelectedCard(userId, input.instrumentId));
  }
  if (input.accountId !== undefined && input.accountId !== existing.accountId) {
    referenceChecks.push(requireOwnedAccount(userId, input.accountId));
  }
  if (input.categorySlug && input.categorySlug !== existing.categorySlug) {
    referenceChecks.push(requireAccessibleCategory(userId, input.categorySlug));
  }
  if (
    input.merchantSlug !== undefined &&
    input.merchantSlug !== existing.merchantSlug
  ) {
    referenceChecks.push(requireAccessibleMerchant(userId, input.merchantSlug));
  }
  if (
    input.paymentAppSlug !== undefined &&
    input.paymentAppSlug !== existing.paymentAppSlug
  ) {
    referenceChecks.push(
      requireAccessiblePaymentApp(userId, input.paymentAppSlug),
    );
  }
  await Promise.all(referenceChecks);

  const reimbursable = input.reimbursable ?? existing.reimbursable;
  const expected = reimbursable
    ? (input.reimbursementExpectedPaise ?? existing.reimbursementExpectedPaise)
    : 0;
  const received = reimbursable ? existing.reimbursementReceivedPaise : 0;
  const nextInstrumentId =
    input.instrumentId !== undefined ? input.instrumentId : existing.instrumentId;
  const nextAccountId =
    input.accountId !== undefined ? input.accountId : existing.accountId;
  const nextOccurredAt = input.occurredAt ?? existing.occurredAt;
  let nextRewardCoverage: "exact" | "partial" | "manual" | null = null;
  if (nextInstrumentId && !nextAccountId) {
    const coverageResult = await admin
      .from("instruments")
      .select("reward_coverage")
      .eq("id", nextInstrumentId)
      .or(`is_catalog_card.eq.true,owner_user_id.eq.${userId}`)
      .maybeSingle();
    if (coverageResult.error) throw coverageResult.error;
    nextRewardCoverage = (coverageResult.data?.reward_coverage ?? "manual") as
      | "exact"
      | "partial"
      | "manual";
  }
  const clearDerivedReward =
    nextRewardCoverage == null || nextRewardCoverage === "manual";
  const nextRewardOverridePaise = nextInstrumentId && !nextAccountId
    ? input.rewardOverridePaise !== undefined
      ? input.rewardOverridePaise
      : existing.rewardOverridePaise
    : null;

  const updateResult = await admin
    .from("expenses")
    .update(toSupabaseRow({
      occurredAt: input.occurredAt ?? existing.occurredAt,
      amountPaise: input.amountPaise ?? existing.amountPaise,
      description: input.description ?? existing.description,
      instrumentId:
        input.instrumentId !== undefined ? input.instrumentId : existing.instrumentId,
      accountId: input.accountId !== undefined ? input.accountId : existing.accountId,
      paymentAppSlug:
        input.paymentAppSlug !== undefined
          ? input.paymentAppSlug
          : existing.paymentAppSlug,
      categorySlug: input.categorySlug ?? existing.categorySlug,
      customLabel: input.customLabel ?? existing.customLabel,
      merchantSlug:
        input.merchantSlug !== undefined ? input.merchantSlug : existing.merchantSlug,
      merchantName: input.merchantName ?? existing.merchantName,
      channel: input.channel ?? existing.channel,
      tags: input.tags ? JSON.stringify(input.tags) : existing.tags,
      notes: input.notes ?? existing.notes,
      flags: input.flags ? JSON.stringify(input.flags) : existing.flags,
      reimbursable,
      reimbursementExpectedPaise: expected,
      reimbursementReceivedPaise: received,
      reimbursementStatus: reimbursementStatusFor(reimbursable, expected, received),
      reimbursementFrom: input.reimbursementFrom ?? existing.reimbursementFrom,
      reimbursementDueDate:
        input.reimbursementDueDate !== undefined
          ? input.reimbursementDueDate
          : existing.reimbursementDueDate,
      reimbursementNote: input.reimbursementNote ?? existing.reimbursementNote,
      rewardOverridePaise: nextRewardOverridePaise,
      ...(clearDerivedReward
        ? {
            rewardRuleId: null,
            rewardUnitsMilli: 0,
            rewardValuePaise:
              nextRewardCoverage === "manual" && nextRewardOverridePaise != null
                ? nextRewardOverridePaise
                : 0,
            rewardCappedUnitsMilli: 0,
            rewardExplain:
              nextRewardCoverage === "manual" && nextRewardOverridePaise != null
                ? "Manual reward confirmed from issuer statement."
                : "",
          }
        : {}),
      updatedAt: stamp(),
    }))
    .eq("id", rowId)
    .eq("user_id", userId);
  if (updateResult.error) throw updateResult.error;

  // Both the old and the new card need their caps replayed.
  const oldContext = existing.instrumentId
    ? `${existing.instrumentId}:${existing.occurredAt.slice(0, 4)}`
    : null;
  const newContext = nextInstrumentId
    ? `${nextInstrumentId}:${nextOccurredAt.slice(0, 4)}`
    : null;
  const contexts = new Set([oldContext, newContext].filter(Boolean));
  await Promise.all(
    [...contexts].map((context) => {
      const [instrumentId, year] = context!.split(":");
      return recomputeInstrumentYear(instrumentId, Number(year));
    }),
  );
  return rowId;
}

export async function deleteExpense(rowId: string) {
  const userId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const existingResult = await admin
    .from("expenses")
    .select("*")
    .eq("id", rowId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const [existing] = fromSupabaseRows<Expense>(
    existingResult.data ? [existingResult.data] : [],
  );
  if (!existing) return false;
  const deleteResult = await admin
    .from("expenses")
    .delete()
    .eq("id", rowId)
    .eq("user_id", userId);
  if (deleteResult.error) throw deleteResult.error;
  await recomputeForDate(existing.instrumentId, existing.occurredAt);
  return true;
}

/* ----------------------------------------------------------- adjustments */

export interface AdjustmentInput {
  label: string;
  kind?:
    | "instant_discount" | "coupon" | "bank_offer" | "cashback"
    | "reward_points" | "gift_card" | "fee" | "surcharge" | "other";
  amountPaise: number;
  immediate?: boolean;
  status?: "expected" | "received";
  receivedAt?: string | null;
  notes?: string;
}

export async function addAdjustment(expenseId: string, input: AdjustmentInput) {
  const userId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const parentResult = await admin
    .from("expenses")
    .select("id")
    .eq("id", expenseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (parentResult.error) throw parentResult.error;
  if (!parentResult.data) return null;
  const rowId = id("adj");
  const result = await admin.from("adjustments").insert(
    toSupabaseRow({
      id: rowId,
      userId,
      expenseId,
      label: input.label,
      kind: input.kind ?? "instant_discount",
      amountPaise: input.amountPaise,
      immediate: input.immediate ?? true,
      status: input.status ?? "received",
      receivedAt: input.receivedAt ?? null,
      notes: input.notes ?? "",
      createdAt: stamp(),
    }),
  );
  if (result.error) throw result.error;
  await touch(expenseId, userId);
  return rowId;
}

export async function updateAdjustment(rowId: string, input: Partial<AdjustmentInput>) {
  const userId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const existingResult = await admin
    .from("adjustments")
    .select("*")
    .eq("id", rowId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const [existing] = fromSupabaseRows<Adjustment>(
    existingResult.data ? [existingResult.data] : [],
  );
  if (!existing) return false;
  const result = await admin
    .from("adjustments")
    .update(toSupabaseRow({
      label: input.label ?? existing.label,
      kind: input.kind ?? existing.kind,
      amountPaise: input.amountPaise ?? existing.amountPaise,
      immediate: input.immediate ?? existing.immediate,
      status: input.status ?? existing.status,
      receivedAt:
        input.receivedAt !== undefined ? input.receivedAt : existing.receivedAt,
      notes: input.notes ?? existing.notes,
    }))
    .eq("id", rowId)
    .eq("user_id", userId);
  if (result.error) throw result.error;
  await touch(existing.expenseId, userId);
  return true;
}

export async function deleteAdjustment(rowId: string) {
  const userId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const existingResult = await admin
    .from("adjustments")
    .select("expense_id")
    .eq("id", rowId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const [existing] = fromSupabaseRows<Pick<Adjustment, "expenseId">>(
    existingResult.data ? [existingResult.data] : [],
  );
  if (!existing) return false;
  const result = await admin
    .from("adjustments")
    .delete()
    .eq("id", rowId)
    .eq("user_id", userId);
  if (result.error) throw result.error;
  await touch(existing.expenseId, userId);
  return true;
}

/* --------------------------------------------------------------- refunds */

export interface RefundInput {
  amountPaise: number;
  refundedAt?: string;
  status?: "pending" | "received";
  reason?: string;
  toInstrumentId?: string | null;
  toAccountId?: string | null;
  notes?: string;
}

export async function addRefund(expenseId: string, input: RefundInput) {
  const userId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const parentResult = await admin
    .from("expenses")
    .select("*")
    .eq("id", expenseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (parentResult.error) throw parentResult.error;
  const [parent] = fromSupabaseRows<Expense>(
    parentResult.data ? [parentResult.data] : [],
  );
  if (!parent) return null;
  const toInstrumentId = input.toInstrumentId ?? parent.instrumentId;
  const toAccountId = input.toAccountId ?? parent.accountId;
  await Promise.all([
    input.toInstrumentId && input.toInstrumentId !== parent.instrumentId
      ? requireSelectedCard(userId, input.toInstrumentId)
      : Promise.resolve(),
    input.toAccountId !== undefined && input.toAccountId !== parent.accountId
      ? requireOwnedAccount(userId, input.toAccountId)
      : Promise.resolve(),
  ]);
  const rowId = id("ref");
  const result = await admin.from("refunds").insert(
    toSupabaseRow({
      id: rowId,
      userId,
      expenseId,
      amountPaise: input.amountPaise,
      refundedAt: input.refundedAt ?? todayISO(),
      status: input.status ?? "received",
      reason: input.reason ?? "",
      toInstrumentId,
      toAccountId,
      notes: input.notes ?? "",
      createdAt: stamp(),
    }),
  );
  if (result.error) throw result.error;
  // A received refund shrinks the reward-eligible amount, so replay the card.
  await recomputeForDate(parent.instrumentId, parent.occurredAt);
  await touch(expenseId, userId);
  return rowId;
}

export async function updateRefund(rowId: string, input: Partial<RefundInput>) {
  const userId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const existingResult = await admin
    .from("refunds")
    .select("*")
    .eq("id", rowId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const [existing] = fromSupabaseRows<Refund>(
    existingResult.data ? [existingResult.data] : [],
  );
  if (!existing) return false;
  const nextInstrumentId =
    input.toInstrumentId !== undefined
      ? input.toInstrumentId
      : existing.toInstrumentId;
  const nextAccountId =
    input.toAccountId !== undefined ? input.toAccountId : existing.toAccountId;
  await Promise.all([
    input.toInstrumentId &&
    input.toInstrumentId !== existing.toInstrumentId
      ? requireSelectedCard(userId, input.toInstrumentId)
      : Promise.resolve(),
    input.toAccountId !== undefined && input.toAccountId !== existing.toAccountId
      ? requireOwnedAccount(userId, input.toAccountId)
      : Promise.resolve(),
  ]);
  const updateResult = await admin
    .from("refunds")
    .update(toSupabaseRow({
      amountPaise: input.amountPaise ?? existing.amountPaise,
      refundedAt: input.refundedAt ?? existing.refundedAt,
      status: input.status ?? existing.status,
      reason: input.reason ?? existing.reason,
      notes: input.notes ?? existing.notes,
      toInstrumentId: nextInstrumentId,
      toAccountId: nextAccountId,
    }))
    .eq("id", rowId)
    .eq("user_id", userId);
  if (updateResult.error) throw updateResult.error;
  const parentResult = await admin
    .from("expenses")
    .select("instrument_id,occurred_at")
    .eq("id", existing.expenseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (parentResult.error) throw parentResult.error;
  const [parent] = fromSupabaseRows<Pick<Expense, "instrumentId" | "occurredAt">>(
    parentResult.data ? [parentResult.data] : [],
  );
  if (parent) await recomputeForDate(parent.instrumentId, parent.occurredAt);
  await touch(existing.expenseId, userId);
  return true;
}

export async function deleteRefund(rowId: string) {
  const userId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const existingResult = await admin
    .from("refunds")
    .select("expense_id")
    .eq("id", rowId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const [existing] = fromSupabaseRows<Pick<Refund, "expenseId">>(
    existingResult.data ? [existingResult.data] : [],
  );
  if (!existing) return false;
  const deleteResult = await admin
    .from("refunds")
    .delete()
    .eq("id", rowId)
    .eq("user_id", userId);
  if (deleteResult.error) throw deleteResult.error;
  const parentResult = await admin
    .from("expenses")
    .select("instrument_id,occurred_at")
    .eq("id", existing.expenseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (parentResult.error) throw parentResult.error;
  const [parent] = fromSupabaseRows<Pick<Expense, "instrumentId" | "occurredAt">>(
    parentResult.data ? [parentResult.data] : [],
  );
  if (parent) await recomputeForDate(parent.instrumentId, parent.occurredAt);
  await touch(existing.expenseId, userId);
  return true;
}

/* -------------------------------------------------------- reimbursements */

export async function recordReimbursement(
  expenseId: string,
  amountPaise: number,
  note?: string,
) {
  const userId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const existingResult = await admin
    .from("expenses")
    .select("*")
    .eq("id", expenseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const [existing] = fromSupabaseRows<Expense>(
    existingResult.data ? [existingResult.data] : [],
  );
  if (!existing) return false;
  const received = Math.max(
    0,
    Math.min(
      existing.reimbursementExpectedPaise,
      existing.reimbursementReceivedPaise + amountPaise,
    ),
  );
  const result = await admin
    .from("expenses")
    .update(toSupabaseRow({
      reimbursementReceivedPaise: received,
      reimbursementStatus: reimbursementStatusFor(
        existing.reimbursable,
        existing.reimbursementExpectedPaise,
        received,
      ),
      reimbursementNote: note ?? existing.reimbursementNote,
      updatedAt: stamp(),
    }))
    .eq("id", expenseId)
    .eq("user_id", userId);
  if (result.error) throw result.error;
  return true;
}

export async function writeOffReimbursement(expenseId: string) {
  const userId = await requireUserId();
  const result = await createSupabaseAdminClient()
    .from("expenses")
    .update(toSupabaseRow({ reimbursementStatus: "written_off", updatedAt: stamp() }))
    .eq("id", expenseId)
    .eq("user_id", userId);
  if (result.error) throw result.error;
  return true;
}

/* ----------------------------------------------- standalone reimbursements */

export interface StandaloneReimbursementInput {
  title: string;
  source: string;
  kind:
    | "fuel"
    | "travel"
    | "meals"
    | "phone_internet"
    | "medical"
    | "allowance"
    | "other";
  expectedPaise: number;
  claimedAt: string;
  dueDate?: string | null;
  notes?: string;
}

export interface StandaloneReimbursementReceiptInput {
  amountPaise: number;
  receivedAt: string;
  note?: string;
}

export async function createStandaloneReimbursement(
  input: StandaloneReimbursementInput,
) {
  const userId = await requireUserId();
  const rowId = id("sre");
  const result = await createSupabaseAdminClient()
    .from("standalone_reimbursements")
    .insert(
      toSupabaseRow({
        id: rowId,
        userId,
        title: input.title,
        source: input.source,
        kind: input.kind,
        expectedPaise: input.expectedPaise,
        claimedAt: input.claimedAt,
        dueDate: input.dueDate ?? null,
        writtenOff: false,
        notes: input.notes ?? "",
        createdAt: stamp(),
        updatedAt: stamp(),
      }),
    );
  if (result.error) throw result.error;
  return rowId;
}

async function standaloneClaimAndReceipts(rowId: string, userId: string) {
  const admin = createSupabaseAdminClient();
  const [claimResult, receiptResult] = await Promise.all([
    admin
      .from("standalone_reimbursements")
      .select("*")
      .eq("id", rowId)
      .eq("user_id", userId)
      .limit(1),
    admin
      .from("standalone_reimbursement_receipts")
      .select("*")
      .eq("reimbursement_id", rowId)
      .eq("user_id", userId),
  ]);
  if (claimResult.error) throw claimResult.error;
  if (receiptResult.error) throw receiptResult.error;

  const [claim] = fromSupabaseRows<StandaloneReimbursement>(claimResult.data);
  const receipts = fromSupabaseRows<StandaloneReimbursementReceipt>(
    receiptResult.data,
  );
  return { admin, claim, receipts };
}

export async function updateStandaloneReimbursement(
  rowId: string,
  input: Partial<StandaloneReimbursementInput>,
) {
  const userId = await requireUserId();
  const { admin, claim, receipts } = await standaloneClaimAndReceipts(rowId, userId);
  if (!claim) return null;

  const state = deriveStandaloneReimbursementState(claim, receipts);
  if (
    input.expectedPaise !== undefined &&
    input.expectedPaise < state.receivedPaise
  ) {
    throw new ApiError(
      "Expected amount cannot be less than money already received.",
      422,
    );
  }

  const values: Record<string, unknown> = { updatedAt: stamp() };
  if (input.title !== undefined) values.title = input.title;
  if (input.source !== undefined) values.source = input.source;
  if (input.kind !== undefined) values.kind = input.kind;
  if (input.expectedPaise !== undefined) {
    values.expectedPaise = input.expectedPaise;
  }
  if (input.claimedAt !== undefined) values.claimedAt = input.claimedAt;
  if (input.dueDate !== undefined) values.dueDate = input.dueDate;
  if (input.notes !== undefined) values.notes = input.notes;

  const updateResult = await admin
    .from("standalone_reimbursements")
    .update(toSupabaseRow(values))
    .eq("id", rowId)
    .eq("user_id", userId)
    .select("id")
    .limit(1);
  if (updateResult.error) throw updateResult.error;
  if (!updateResult.data?.length) return null;
  return rowId;
}

export async function deleteStandaloneReimbursement(rowId: string) {
  const userId = await requireUserId();
  const result = await createSupabaseAdminClient()
    .from("standalone_reimbursements")
    .delete()
    .eq("id", rowId)
    .eq("user_id", userId)
    .select("id")
    .limit(1);
  if (result.error) throw result.error;
  return !!result.data?.length;
}

export async function recordStandaloneReimbursementReceipt(
  reimbursementId: string,
  input: StandaloneReimbursementReceiptInput,
) {
  const userId = await requireUserId();
  const rowId = id("srr");
  const result = await createSupabaseAdminClient().rpc(
    "ledgerkit_record_standalone_receipt",
    {
      p_user_id: userId,
      p_reimbursement_id: reimbursementId,
      p_receipt_id: rowId,
      p_amount_paise: input.amountPaise,
      p_received_at: input.receivedAt,
      p_note: input.note ?? "",
      p_created_at: stamp(),
    },
  );
  if (result.error) {
    if (result.error.message.includes("not found")) {
      throw new ApiError("Reimbursement not found.", 404);
    }
    if (result.error.message.includes("written-off")) {
      throw new ApiError(
        "A payment cannot be recorded for a written-off reimbursement.",
        409,
      );
    }
    if (result.error.message.includes("outstanding")) {
      throw new ApiError(
        "Payment cannot exceed the outstanding reimbursement amount.",
        422,
      );
    }
    throw result.error;
  }
  return rowId;
}

async function touch(expenseId: string, userId: string) {
  const result = await createSupabaseAdminClient()
    .from("expenses")
    .update(toSupabaseRow({ updatedAt: stamp() }))
    .eq("id", expenseId)
    .eq("user_id", userId);
  if (result.error) throw result.error;
}

/* ----------------------------------------------------------- instruments */

export async function updateInstrument(rowId: string, patch: Record<string, unknown>) {
  const admin = createSupabaseAdminClient();
  const existingResult = await admin
    .from("instruments")
    .select("id")
    .eq("id", rowId)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  if (!existingResult.data) return false;
  const allowed: Record<string, unknown> = {};
  const keys = [
    "name", "shortName", "issuer", "network", "kind", "last4", "colorFrom",
    "colorTo", "accountId", "creditLimitPaise", "statementDay", "dueDay",
    "rewardUnit", "unitValuePaise", "rewardKind", "overallCapUnits",
    "overallCapPeriod", "annualFeePaise", "feeWaiverSpendPaise",
    "forexMarkupBps", "sourceNote", "archived", "sortOrder",
  ];
  for (const k of keys) if (patch[k] !== undefined) allowed[k] = patch[k];
  if (patch.excludedCategories !== undefined)
    allowed.excludedCategories = JSON.stringify(patch.excludedCategories);
  if (patch.perks !== undefined) allowed.perks = JSON.stringify(patch.perks);
  if (patch.options !== undefined) allowed.options = JSON.stringify(patch.options);

  if (Object.keys(allowed).length) {
    const updateResult = await admin
      .from("instruments")
      .update(toSupabaseRow(allowed))
      .eq("id", rowId);
    if (updateResult.error) throw updateResult.error;
  }
  await recomputeInstrumentYear(rowId, new Date().getFullYear());
  return true;
}

export async function createInstrument(patch: Record<string, unknown>) {
  const rowId = id("card");
  const result = await createSupabaseAdminClient()
    .from("instruments")
    .insert(toSupabaseRow({
      id: rowId,
      name: String(patch.name ?? "New card"),
      shortName: String(patch.shortName ?? patch.name ?? "New card"),
      issuer: String(patch.issuer ?? ""),
      network: (patch.network as "visa") ?? "visa",
      kind: (patch.kind as "credit") ?? "credit",
      last4: String(patch.last4 ?? ""),
      colorFrom: String(patch.colorFrom ?? "#334155"),
      colorTo: String(patch.colorTo ?? "#0F172A"),
      accountId: (patch.accountId as string) ?? null,
      creditLimitPaise: Number(patch.creditLimitPaise ?? 0),
      statementDay: Number(patch.statementDay ?? 1),
      dueDay: Number(patch.dueDay ?? 20),
      rewardUnit: String(patch.rewardUnit ?? "INR"),
      unitValuePaise: Number(patch.unitValuePaise ?? 100),
      rewardKind: (patch.rewardKind as "statement_cashback") ?? "statement_cashback",
      overallCapUnits: (patch.overallCapUnits as number) ?? null,
      overallCapPeriod: (patch.overallCapPeriod as "none") ?? "none",
      excludedCategories: JSON.stringify(patch.excludedCategories ?? []),
      options: JSON.stringify(patch.options ?? {}),
      annualFeePaise: Number(patch.annualFeePaise ?? 0),
      feeWaiverSpendPaise: Number(patch.feeWaiverSpendPaise ?? 0),
      forexMarkupBps: Number(patch.forexMarkupBps ?? 350),
      perks: JSON.stringify(patch.perks ?? []),
      sourceNote: String(patch.sourceNote ?? ""),
      archived: false,
      sortOrder: 99,
      createdAt: stamp(),
    }));
  if (result.error) throw result.error;
  return rowId;
}

export async function deleteInstrument(rowId: string) {
  const admin = createSupabaseAdminClient();
  const expenseResult = await admin
    .from("expenses")
    .update(toSupabaseRow({
      instrumentId: null,
      rewardRuleId: null,
      rewardUnitsMilli: 0,
      rewardValuePaise: 0,
      rewardCappedUnitsMilli: 0,
      rewardExplain: "",
      updatedAt: stamp(),
    }))
    .eq("instrument_id", rowId);
  if (expenseResult.error) throw expenseResult.error;
  const deleteResult = await admin
    .from("instruments")
    .delete()
    .eq("id", rowId);
  if (deleteResult.error) throw deleteResult.error;
  return true;
}

/* ----------------------------------------------------------------- rules */

const RULE_KEYS = [
  "name", "priority", "isBase", "channel", "rateType", "rateBps",
  "blockSizePaise", "pointsPerBlock", "minTxnPaise", "maxTxnPaise",
  "capUnits", "capPeriod", "capGroup", "validFrom", "validTo", "active", "notes",
  "requiresFlag", "requiresFlagValue",
];
const RULE_JSON_KEYS = [
  "matchMerchants", "matchCategories", "matchApps",
  "excludeCategories", "excludeMerchants",
];

export async function createRule(instrumentId: string, patch: Record<string, unknown>) {
  const rowId = id("rule");
  const values: Record<string, unknown> = {
    id: rowId,
    instrumentId,
    name: String(patch.name ?? "New rule"),
    priority: Number(patch.priority ?? 0),
    isBase: !!patch.isBase,
    matchMerchants: JSON.stringify(patch.matchMerchants ?? []),
    matchCategories: JSON.stringify(patch.matchCategories ?? []),
    matchApps: JSON.stringify(patch.matchApps ?? []),
    channel: patch.channel ?? "any",
    rateType: patch.rateType ?? "percent",
    rateBps: Number(patch.rateBps ?? 0),
    blockSizePaise: Number(patch.blockSizePaise ?? 10000),
    pointsPerBlock: Number(patch.pointsPerBlock ?? 0),
    minTxnPaise: Number(patch.minTxnPaise ?? 0),
    maxTxnPaise: (patch.maxTxnPaise as number) ?? null,
    capUnits: (patch.capUnits as number) ?? null,
    capPeriod: patch.capPeriod ?? "none",
    capGroup: String(patch.capGroup ?? rowId),
    excludeCategories: JSON.stringify(patch.excludeCategories ?? []),
    excludeMerchants: JSON.stringify(patch.excludeMerchants ?? []),
    requiresFlag: (patch.requiresFlag as string) || null,
    requiresFlagValue: patch.requiresFlagValue !== false,
    validFrom: (patch.validFrom as string) ?? null,
    validTo: (patch.validTo as string) ?? null,
    active: patch.active !== false,
    notes: String(patch.notes ?? ""),
    createdAt: stamp(),
  };
  const result = await createSupabaseAdminClient()
    .from("reward_rules")
    .insert(toSupabaseRow(values));
  if (result.error) throw result.error;
  await recomputeInstrumentYear(instrumentId, new Date().getFullYear());
  return rowId;
}

export async function updateRule(rowId: string, patch: Record<string, unknown>) {
  const admin = createSupabaseAdminClient();
  const existingResult = await admin
    .from("reward_rules")
    .select("*")
    .eq("id", rowId)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const [existing] = fromSupabaseRows<RewardRule>(
    existingResult.data ? [existingResult.data] : [],
  );
  if (!existing) return false;
  const values: Record<string, unknown> = {};
  for (const k of RULE_KEYS) if (patch[k] !== undefined) values[k] = patch[k];
  for (const k of RULE_JSON_KEYS)
    if (patch[k] !== undefined) values[k] = JSON.stringify(patch[k]);
  if (Object.keys(values).length) {
    const updateResult = await admin
      .from("reward_rules")
      .update(toSupabaseRow(values))
      .eq("id", rowId);
    if (updateResult.error) throw updateResult.error;
  }
  await recomputeInstrumentYear(existing.instrumentId, new Date().getFullYear());
  return true;
}

export async function deleteRule(rowId: string) {
  const admin = createSupabaseAdminClient();
  const existingResult = await admin
    .from("reward_rules")
    .select("instrument_id")
    .eq("id", rowId)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const [existing] = fromSupabaseRows<Pick<RewardRule, "instrumentId">>(
    existingResult.data ? [existingResult.data] : [],
  );
  if (!existing) return false;
  const deleteResult = await admin
    .from("reward_rules")
    .delete()
    .eq("id", rowId);
  if (deleteResult.error) throw deleteResult.error;
  await recomputeInstrumentYear(existing.instrumentId, new Date().getFullYear());
  return true;
}

/* -------------------------------------------------------------- accounts */

export async function createAccount(patch: Record<string, unknown>) {
  const userId = await requireUserId();
  const rowId = id("acct");
  const result = await createSupabaseAdminClient()
    .from("accounts")
    .insert(toSupabaseRow({
      id: rowId,
      userId,
      name: String(patch.name ?? "New account"),
      bank: String(patch.bank ?? ""),
      kind: (patch.kind as "savings") ?? "savings",
      last4: String(patch.last4 ?? ""),
      balancePaise: Number(patch.openingBalancePaise ?? 0),
      openingBalancePaise: Number(patch.openingBalancePaise ?? 0),
      openingDate: String(patch.openingDate ?? todayISO()),
      colorHex: String(patch.colorHex ?? "#4B5563"),
      upiHandle: String(patch.upiHandle ?? ""),
      includeInTotals: patch.includeInTotals !== false,
      archived: false,
      sortOrder: Number(patch.sortOrder ?? 50),
      notes: String(patch.notes ?? ""),
      createdAt: stamp(),
    }));
  if (result.error) throw result.error;
  return rowId;
}

export async function updateAccount(rowId: string, patch: Record<string, unknown>) {
  const userId = await requireUserId();
  const values: Record<string, unknown> = {};
  for (const k of [
    "name", "bank", "kind", "last4", "openingBalancePaise", "openingDate",
    "colorHex", "upiHandle", "includeInTotals", "archived", "sortOrder", "notes",
  ])
    if (patch[k] !== undefined) values[k] = patch[k];
  if (!Object.keys(values).length) return false;
  const result = await createSupabaseAdminClient()
    .from("accounts")
    .update(toSupabaseRow(values))
    .eq("id", rowId)
    .eq("user_id", userId)
    .select("id")
    .limit(1);
  if (result.error) throw result.error;
  return !!result.data?.length;
}

export async function deleteAccount(rowId: string) {
  const userId = await requireUserId();
  await requireOwnedAccount(userId, rowId);
  const admin = createSupabaseAdminClient();
  const unlinkResults = await Promise.all([
    admin
      .from("expenses")
      .update({ account_id: null })
      .eq("account_id", rowId)
      .eq("user_id", userId),
    admin
      .from("refunds")
      .update({ to_account_id: null })
      .eq("to_account_id", rowId)
      .eq("user_id", userId),
    admin
      .from("transfers")
      .update({ account_id: null })
      .eq("account_id", rowId)
      .eq("user_id", userId),
  ]);
  const unlinkError = unlinkResults.find((result) => result.error)?.error;
  if (unlinkError) throw unlinkError;
  const deleteResult = await admin
    .from("accounts")
    .delete()
    .eq("id", rowId)
    .eq("user_id", userId)
    .select("id")
    .limit(1);
  if (deleteResult.error) throw deleteResult.error;
  return !!deleteResult.data?.length;
}

/**
 * Live balance = opening balance, minus everything spent from the account,
 * plus refunds and money received, since the opening date.
 */
export async function computeAccountBalances(authenticatedUserId?: string) {
  const userId = authenticatedUserId ?? await requireUserId();
  const admin = createSupabaseAdminClient();
  const [accountResult, expenseResult, refundResult, transferResult] =
    await Promise.all([
      admin.from("accounts").select("*").eq("user_id", userId),
      admin
        .from("expenses")
        .select("account_id,amount_paise,occurred_at")
        .eq("user_id", userId)
        .not("account_id", "is", null),
      admin
        .from("refunds")
        .select("to_account_id,amount_paise,refunded_at")
        .eq("user_id", userId)
        .eq("status", "received")
        .not("to_account_id", "is", null),
      admin
        .from("transfers")
        .select("account_id,amount_paise,occurred_at,direction")
        .eq("user_id", userId)
        .not("account_id", "is", null),
    ]);
  const error = [accountResult, expenseResult, refundResult, transferResult]
    .find((result) => result.error)?.error;
  if (error) throw error;
  const all = fromSupabaseRows<Account>(accountResult.data);
  if (!all.length) return [];
  const expenseRows = fromSupabaseRows<Pick<Expense, "accountId" | "amountPaise" | "occurredAt">>(expenseResult.data);
  const refundRows = fromSupabaseRows<Pick<Refund, "toAccountId" | "amountPaise" | "refundedAt">>(refundResult.data);
  const transferRows = fromSupabaseRows<Pick<Transfer, "accountId" | "amountPaise" | "occurredAt" | "direction">>(transferResult.data);

  return all.map((account) => {
    const spent = expenseRows
      .filter((row) => row.accountId === account.id && row.occurredAt >= account.openingDate)
      .reduce((sum, row) => sum + row.amountPaise, 0);
    const refunded = refundRows
      .filter((row) => row.toAccountId === account.id && row.refundedAt >= account.openingDate)
      .reduce((sum, row) => sum + row.amountPaise, 0);
    const sent = transferRows
      .filter((row) => row.accountId === account.id && row.direction === "sent" && row.occurredAt >= account.openingDate)
      .reduce((sum, row) => sum + row.amountPaise, 0);
    const received = transferRows
      .filter((row) => row.accountId === account.id && row.direction === "received" && row.occurredAt >= account.openingDate)
      .reduce((sum, row) => sum + row.amountPaise, 0);

    const balancePaise =
      account.openingBalancePaise - spent + refunded - sent + received;
    return {
      account,
      balancePaise,
      spentPaise: spent,
      refundedPaise: refunded,
      sentPaise: sent,
      receivedPaise: received,
    };
  });
}

/* ---------------------------------------------------------------- people */

export async function createPerson(patch: Record<string, unknown>) {
  const userId = await requireUserId();
  const rowId = id("per");
  const result = await createSupabaseAdminClient()
    .from("people")
    .insert(toSupabaseRow({
      id: rowId,
      userId,
      name: String(patch.name ?? "Someone"),
      relation: (patch.relation as "friend") ?? "friend",
      colorHex: String(patch.colorHex ?? "#4C6EF5"),
      upiHandle: String(patch.upiHandle ?? ""),
      phone: String(patch.phone ?? ""),
      notes: String(patch.notes ?? ""),
      archived: false,
      createdAt: stamp(),
    }));
  if (result.error) throw result.error;
  return rowId;
}

export async function updatePerson(rowId: string, patch: Record<string, unknown>) {
  const userId = await requireUserId();
  const values: Record<string, unknown> = {};
  for (const k of ["name", "relation", "colorHex", "upiHandle", "phone", "notes", "archived"])
    if (patch[k] !== undefined) values[k] = patch[k];
  if (!Object.keys(values).length) return false;
  const result = await createSupabaseAdminClient()
    .from("people")
    .update(toSupabaseRow(values))
    .eq("id", rowId)
    .eq("user_id", userId);
  if (result.error) throw result.error;
  return true;
}

export async function deletePerson(rowId: string) {
  const userId = await requireUserId();
  const result = await createSupabaseAdminClient()
    .from("people")
    .delete()
    .eq("id", rowId)
    .eq("user_id", userId);
  if (result.error) throw result.error;
  return true;
}

export async function createTransfer(patch: Record<string, unknown>) {
  const userId = await requireUserId();
  const instrumentId = (patch.instrumentId as string) || null;
  await Promise.all([
    instrumentId
      ? requireSelectedCard(userId, instrumentId)
      : Promise.resolve(),
    validateTransferOwnershipReferences(userId, {
      accountId: (patch.accountId as string) ?? null,
      personId: (patch.personId as string) ?? null,
      paymentAppSlug: (patch.paymentAppSlug as string) ?? null,
      relatedExpenseId: (patch.relatedExpenseId as string) ?? null,
      settlesTransferId: (patch.settlesTransferId as string) ?? null,
    }),
  ]);
  const rowId = id("tr");
  const result = await createSupabaseAdminClient()
    .from("transfers")
    .insert(toSupabaseRow({
      id: rowId,
      userId,
      direction: (patch.direction as "sent") ?? "sent",
      personId: (patch.personId as string) ?? null,
      amountPaise: Number(patch.amountPaise ?? 0),
      occurredAt: String(patch.occurredAt ?? todayISO()),
      instrumentId,
      accountId: (patch.accountId as string) ?? null,
      paymentAppSlug: (patch.paymentAppSlug as string) ?? null,
      purpose: (patch.purpose as "other") ?? "other",
      countsAsSpend: !!patch.countsAsSpend,
      balanceTreatment:
        (patch.balanceTreatment as BalanceTreatment | undefined) ??
        inferBalanceTreatment({
          direction: (patch.direction as "sent" | "received") ?? "sent",
          purpose: String(patch.purpose ?? "other"),
          countsAsSpend: !!patch.countsAsSpend,
        }),
      settlesTransferId: (patch.settlesTransferId as string) ?? null,
      relatedExpenseId: (patch.relatedExpenseId as string) ?? null,
      note: String(patch.note ?? ""),
      createdAt: stamp(),
    }));
  if (result.error) throw result.error;
  return rowId;
}

export async function updateTransfer(rowId: string, patch: Record<string, unknown>) {
  const userId = await requireUserId();
  const existingResult = await createSupabaseAdminClient()
    .from("transfers")
    .select("*")
    .eq("id", rowId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const [existing] = fromSupabaseRows<Transfer>(
    existingResult.data ? [existingResult.data] : [],
  );
  if (!existing) return false;

  const referenceChecks: Promise<void>[] = [];
  if (
    patch.instrumentId !== undefined &&
    patch.instrumentId !== existing.instrumentId &&
    patch.instrumentId
  ) {
    referenceChecks.push(requireSelectedCard(userId, String(patch.instrumentId)));
  }
  if (patch.accountId !== undefined && patch.accountId !== existing.accountId) {
    referenceChecks.push(
      requireOwnedAccount(userId, patch.accountId as string | null),
    );
  }
  if (patch.personId !== undefined && patch.personId !== existing.personId) {
    referenceChecks.push(
      requireOwnedPerson(userId, patch.personId as string | null),
    );
  }
  if (
    patch.paymentAppSlug !== undefined &&
    patch.paymentAppSlug !== existing.paymentAppSlug
  ) {
    referenceChecks.push(
      requireAccessiblePaymentApp(
        userId,
        patch.paymentAppSlug as string | null,
      ),
    );
  }
  if (
    patch.relatedExpenseId !== undefined &&
    patch.relatedExpenseId !== existing.relatedExpenseId
  ) {
    referenceChecks.push(
      requireOwnedExpense(userId, patch.relatedExpenseId as string | null),
    );
  }
  if (
    patch.settlesTransferId !== undefined &&
    patch.settlesTransferId !== existing.settlesTransferId
  ) {
    referenceChecks.push(
      requireOwnedTransfer(userId, patch.settlesTransferId as string | null),
    );
  }
  await Promise.all(referenceChecks);
  const values: Record<string, unknown> = {};
  for (const k of [
    "direction", "personId", "amountPaise", "occurredAt", "instrumentId",
    "accountId", "paymentAppSlug", "purpose", "countsAsSpend",
    "balanceTreatment", "settlesTransferId", "relatedExpenseId", "note",
  ])
    if (patch[k] !== undefined) values[k] = patch[k];
  if (!Object.keys(values).length) return false;
  const result = await createSupabaseAdminClient()
    .from("transfers")
    .update(toSupabaseRow(values))
    .eq("id", rowId)
    .eq("user_id", userId);
  if (result.error) throw result.error;
  return true;
}

export async function deleteTransfer(rowId: string) {
  const userId = await requireUserId();
  const result = await createSupabaseAdminClient()
    .from("transfers")
    .delete()
    .eq("id", rowId)
    .eq("user_id", userId);
  if (result.error) throw result.error;
  return true;
}

/* ------------------------------------------------------------- taxonomy */

export async function createCategory(patch: Record<string, unknown>) {
  const userId = await requireUserId();
  const name = String(patch.name ?? "New category");
  const parentSlug = (patch.parentSlug as string) || null;
  if (parentSlug) await requireAccessibleCategory(userId, parentSlug);
  const { slug, existingId } = await allocateOwnedReferenceSlug(
    "categories",
    userId,
    String(patch.slug ?? name),
  );
  if (existingId) return existingId;
  const rowId = id("cat");
  const result = await createSupabaseAdminClient()
    .from("categories")
    .insert(toSupabaseRow({
      id: rowId,
      name,
      slug,
      icon: String(patch.icon ?? "Shapes"),
      colorHex: String(patch.colorHex ?? "#868E96"),
      parentSlug,
      requiresLabel: !!patch.requiresLabel,
      isSystem: false,
      ownerUserId: userId,
      archived: false,
      sortOrder: 900,
    }));
  if (result.error) throw result.error;
  return rowId;
}

export async function updateCategory(rowId: string, patch: Record<string, unknown>) {
  const userId = await requireUserId();
  if (typeof patch.parentSlug === "string" && patch.parentSlug) {
    await requireAccessibleCategory(userId, patch.parentSlug);
  }
  const values: Record<string, unknown> = {};
  for (const k of ["name", "icon", "colorHex", "parentSlug", "requiresLabel", "archived", "sortOrder"])
    if (patch[k] !== undefined) values[k] = patch[k];
  if (!Object.keys(values).length) return false;
  const result = await createSupabaseAdminClient()
    .from("categories")
    .update(toSupabaseRow(values))
    .eq("id", rowId)
    .eq("owner_user_id", userId)
    .eq("is_system", false)
    .select("id")
    .limit(1);
  if (result.error) throw result.error;
  return !!result.data?.length;
}

export async function createMerchant(patch: Record<string, unknown>) {
  const userId = await requireUserId();
  const name = String(patch.name ?? "New merchant");
  const categorySlug = (patch.categorySlug as string) || null;
  if (categorySlug) await requireAccessibleCategory(userId, categorySlug);
  const { slug, existingId } = await allocateOwnedReferenceSlug(
    "merchants",
    userId,
    String(patch.slug ?? name),
  );
  if (existingId) return existingId;
  const rowId = id("mer");
  const result = await createSupabaseAdminClient()
    .from("merchants")
    .insert(toSupabaseRow({
      id: rowId,
      name,
      slug,
      categorySlug,
      colorHex: String(patch.colorHex ?? "#868E96"),
      isSystem: false,
      ownerUserId: userId,
    }));
  if (result.error) throw result.error;
  return rowId;
}

export async function createPaymentApp(patch: Record<string, unknown>) {
  const userId = await requireUserId();
  const name = String(patch.name ?? "New app");
  const { slug, existingId } = await allocateOwnedReferenceSlug(
    "payment_apps",
    userId,
    String(patch.slug ?? name),
  );
  if (existingId) return existingId;
  const rowId = id("app");
  const result = await createSupabaseAdminClient()
    .from("payment_apps")
    .insert(toSupabaseRow({
      id: rowId,
      name,
      slug,
      kind: (patch.kind as "upi") ?? "upi",
      colorHex: String(patch.colorHex ?? "#868E96"),
      isSystem: false,
      ownerUserId: userId,
      sortOrder: 900,
    }));
  if (result.error) throw result.error;
  return rowId;
}

/* ------------------------------------------------------------------ misc */

export async function setSetting(key: string, value: string) {
  const userId = await requireUserId();
  const ownedKey = `${userId}:${key}`;
  const result = await createSupabaseAdminClient()
    .from("settings")
    .upsert({ key: ownedKey, value }, { onConflict: "key" });
  if (result.error) throw result.error;
}

export async function getSetting(key: string): Promise<string | null> {
  const userId = await requireUserId();
  const result = await createSupabaseAdminClient()
    .from("settings")
    .select("value")
    .eq("key", `${userId}:${key}`)
    .maybeSingle();
  if (result.error) throw result.error;
  return typeof result.data?.value === "string" ? result.data.value : null;
}

export async function clearTransactions() {
  const userId = await requireUserId();
  const admin = createSupabaseAdminClient();
  for (const table of ["adjustments", "refunds", "expenses", "transfers"] as const) {
    const result = await admin.from(table).delete().eq("user_id", userId);
    if (result.error) throw result.error;
  }
  await setSetting("demo_loaded", "no");
  return true;
}
