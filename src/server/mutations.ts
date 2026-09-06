import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import {
  accounts,
  adjustments,
  categories,
  expenses,
  instruments,
  merchants,
  paymentApps,
  people,
  refunds,
  rewardRules,
  settings,
  transfers,
} from "@/db/schema";
import { recomputeForDate, recomputeInstrumentYear } from "@/lib/rewards/recompute";
import { todayISO } from "@/lib/rewards/periods";
import { requireUserId } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fromSupabaseRows } from "@/lib/supabase/rows";

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
  const rowId = id("exp");
  const reimbursable = !!input.reimbursable;
  const expected = reimbursable ? (input.reimbursementExpectedPaise ?? 0) : 0;

  await db.insert(expenses)
    .values({
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
      rewardOverridePaise: input.rewardOverridePaise ?? null,
      createdAt: stamp(),
      updatedAt: stamp(),
    });

  await recomputeForDate(input.instrumentId ?? null, input.occurredAt);
  return rowId;
}

export async function updateExpense(rowId: string, input: Partial<ExpenseInput>) {
  const userId = await requireUserId();
  const [existing] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, rowId), eq(expenses.userId, userId)))
    .limit(1);
  if (!existing) return null;

  const reimbursable = input.reimbursable ?? existing.reimbursable;
  const expected = reimbursable
    ? (input.reimbursementExpectedPaise ?? existing.reimbursementExpectedPaise)
    : 0;
  const received = reimbursable ? existing.reimbursementReceivedPaise : 0;

  await db.update(expenses)
    .set({
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
      rewardOverridePaise:
        input.rewardOverridePaise !== undefined
          ? input.rewardOverridePaise
          : existing.rewardOverridePaise,
      updatedAt: stamp(),
    })
    .where(and(eq(expenses.id, rowId), eq(expenses.userId, userId)));

  // Both the old and the new card need their caps replayed.
  await recomputeForDate(existing.instrumentId, existing.occurredAt);
  await recomputeForDate(
    input.instrumentId !== undefined ? input.instrumentId : existing.instrumentId,
    input.occurredAt ?? existing.occurredAt,
  );
  return rowId;
}

export async function deleteExpense(rowId: string) {
  const userId = await requireUserId();
  const [existing] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, rowId), eq(expenses.userId, userId)))
    .limit(1);
  if (!existing) return false;
  await db
    .delete(expenses)
    .where(and(eq(expenses.id, rowId), eq(expenses.userId, userId)));
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
  const [parent] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
    .limit(1);
  if (!parent) return null;
  const rowId = id("adj");
  await db.insert(adjustments)
    .values({
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
    });
  await touch(expenseId, userId);
  return rowId;
}

export async function updateAdjustment(rowId: string, input: Partial<AdjustmentInput>) {
  const userId = await requireUserId();
  const [existing] = await db
    .select()
    .from(adjustments)
    .where(and(eq(adjustments.id, rowId), eq(adjustments.userId, userId)))
    .limit(1);
  if (!existing) return false;
  await db.update(adjustments)
    .set({
      label: input.label ?? existing.label,
      kind: input.kind ?? existing.kind,
      amountPaise: input.amountPaise ?? existing.amountPaise,
      immediate: input.immediate ?? existing.immediate,
      status: input.status ?? existing.status,
      receivedAt:
        input.receivedAt !== undefined ? input.receivedAt : existing.receivedAt,
      notes: input.notes ?? existing.notes,
    })
    .where(and(eq(adjustments.id, rowId), eq(adjustments.userId, userId)));
  await touch(existing.expenseId, userId);
  return true;
}

export async function deleteAdjustment(rowId: string) {
  const userId = await requireUserId();
  const [existing] = await db
    .select()
    .from(adjustments)
    .where(and(eq(adjustments.id, rowId), eq(adjustments.userId, userId)))
    .limit(1);
  if (!existing) return false;
  await db
    .delete(adjustments)
    .where(and(eq(adjustments.id, rowId), eq(adjustments.userId, userId)));
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
  const [parent] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
    .limit(1);
  if (!parent) return null;
  const rowId = id("ref");
  await db.insert(refunds)
    .values({
      id: rowId,
      userId,
      expenseId,
      amountPaise: input.amountPaise,
      refundedAt: input.refundedAt ?? todayISO(),
      status: input.status ?? "received",
      reason: input.reason ?? "",
      toInstrumentId: input.toInstrumentId ?? parent.instrumentId,
      toAccountId: input.toAccountId ?? parent.accountId,
      notes: input.notes ?? "",
      createdAt: stamp(),
    });
  // A received refund shrinks the reward-eligible amount, so replay the card.
  await recomputeForDate(parent.instrumentId, parent.occurredAt);
  await touch(expenseId, userId);
  return rowId;
}

export async function updateRefund(rowId: string, input: Partial<RefundInput>) {
  const userId = await requireUserId();
  const [existing] = await db
    .select()
    .from(refunds)
    .where(and(eq(refunds.id, rowId), eq(refunds.userId, userId)))
    .limit(1);
  if (!existing) return false;
  await db.update(refunds)
    .set({
      amountPaise: input.amountPaise ?? existing.amountPaise,
      refundedAt: input.refundedAt ?? existing.refundedAt,
      status: input.status ?? existing.status,
      reason: input.reason ?? existing.reason,
      notes: input.notes ?? existing.notes,
      toInstrumentId:
        input.toInstrumentId !== undefined
          ? input.toInstrumentId
          : existing.toInstrumentId,
      toAccountId:
        input.toAccountId !== undefined ? input.toAccountId : existing.toAccountId,
    })
    .where(and(eq(refunds.id, rowId), eq(refunds.userId, userId)));
  const [parent] = await db
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.id, existing.expenseId),
        eq(expenses.userId, userId),
      ),
    )
    .limit(1);
  if (parent) await recomputeForDate(parent.instrumentId, parent.occurredAt);
  await touch(existing.expenseId, userId);
  return true;
}

export async function deleteRefund(rowId: string) {
  const userId = await requireUserId();
  const [existing] = await db
    .select()
    .from(refunds)
    .where(and(eq(refunds.id, rowId), eq(refunds.userId, userId)))
    .limit(1);
  if (!existing) return false;
  await db
    .delete(refunds)
    .where(and(eq(refunds.id, rowId), eq(refunds.userId, userId)));
  const [parent] = await db
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.id, existing.expenseId),
        eq(expenses.userId, userId),
      ),
    )
    .limit(1);
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
  const [existing] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
    .limit(1);
  if (!existing) return false;
  const received = Math.max(
    0,
    Math.min(
      existing.reimbursementExpectedPaise,
      existing.reimbursementReceivedPaise + amountPaise,
    ),
  );
  await db.update(expenses)
    .set({
      reimbursementReceivedPaise: received,
      reimbursementStatus: reimbursementStatusFor(
        existing.reimbursable,
        existing.reimbursementExpectedPaise,
        received,
      ),
      reimbursementNote: note ?? existing.reimbursementNote,
      updatedAt: stamp(),
    })
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)));
  return true;
}

export async function writeOffReimbursement(expenseId: string) {
  const userId = await requireUserId();
  await db.update(expenses)
    .set({ reimbursementStatus: "written_off", updatedAt: stamp() })
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)));
  return true;
}

async function touch(expenseId: string, userId: string) {
  await db.update(expenses)
    .set({ updatedAt: stamp() })
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)));
}

/* ----------------------------------------------------------- instruments */

export async function updateInstrument(rowId: string, patch: Record<string, unknown>) {
  const [existing] = await db.select().from(instruments).where(eq(instruments.id, rowId)).limit(1);
  if (!existing) return false;
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

  await db.update(instruments).set(allowed).where(eq(instruments.id, rowId));
  await recomputeInstrumentYear(rowId, new Date().getFullYear());
  return true;
}

export async function createInstrument(patch: Record<string, unknown>) {
  const rowId = id("card");
  await db.insert(instruments)
    .values({
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
    });
  return rowId;
}

export async function deleteInstrument(rowId: string) {
  await db.update(expenses)
    .set({ instrumentId: null })
    .where(eq(expenses.instrumentId, rowId));
  await db.delete(instruments).where(eq(instruments.id, rowId));
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
  await db.insert(rewardRules).values(values as never);
  await recomputeInstrumentYear(instrumentId, new Date().getFullYear());
  return rowId;
}

export async function updateRule(rowId: string, patch: Record<string, unknown>) {
  const [existing] = await db.select().from(rewardRules).where(eq(rewardRules.id, rowId)).limit(1);
  if (!existing) return false;
  const values: Record<string, unknown> = {};
  for (const k of RULE_KEYS) if (patch[k] !== undefined) values[k] = patch[k];
  for (const k of RULE_JSON_KEYS)
    if (patch[k] !== undefined) values[k] = JSON.stringify(patch[k]);
  if (Object.keys(values).length) {
    await db.update(rewardRules).set(values).where(eq(rewardRules.id, rowId));
  }
  await recomputeInstrumentYear(existing.instrumentId, new Date().getFullYear());
  return true;
}

export async function deleteRule(rowId: string) {
  const [existing] = await db.select().from(rewardRules).where(eq(rewardRules.id, rowId)).limit(1);
  if (!existing) return false;
  await db.delete(rewardRules).where(eq(rewardRules.id, rowId));
  await recomputeInstrumentYear(existing.instrumentId, new Date().getFullYear());
  return true;
}

/* -------------------------------------------------------------- accounts */

export async function createAccount(patch: Record<string, unknown>) {
  const rowId = id("acct");
  await db.insert(accounts)
    .values({
      id: rowId,
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
    });
  return rowId;
}

export async function updateAccount(rowId: string, patch: Record<string, unknown>) {
  const values: Record<string, unknown> = {};
  for (const k of [
    "name", "bank", "kind", "last4", "openingBalancePaise", "openingDate",
    "colorHex", "upiHandle", "includeInTotals", "archived", "sortOrder", "notes",
  ])
    if (patch[k] !== undefined) values[k] = patch[k];
  if (!Object.keys(values).length) return false;
  await db.update(accounts).set(values).where(eq(accounts.id, rowId));
  return true;
}

export async function deleteAccount(rowId: string) {
  await db.update(expenses).set({ accountId: null }).where(eq(expenses.accountId, rowId));
  await db.delete(accounts).where(eq(accounts.id, rowId));
  return true;
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
      admin.from("accounts").select("*"),
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
  const all = fromSupabaseRows<typeof accounts.$inferSelect>(accountResult.data);
  if (!all.length) return [];
  const expenseRows = fromSupabaseRows<Pick<typeof expenses.$inferSelect, "accountId" | "amountPaise" | "occurredAt">>(expenseResult.data);
  const refundRows = fromSupabaseRows<Pick<typeof refunds.$inferSelect, "toAccountId" | "amountPaise" | "refundedAt">>(refundResult.data);
  const transferRows = fromSupabaseRows<Pick<typeof transfers.$inferSelect, "accountId" | "amountPaise" | "occurredAt" | "direction">>(transferResult.data);

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
  await db.insert(people)
    .values({
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
    });
  return rowId;
}

export async function updatePerson(rowId: string, patch: Record<string, unknown>) {
  const userId = await requireUserId();
  const values: Record<string, unknown> = {};
  for (const k of ["name", "relation", "colorHex", "upiHandle", "phone", "notes", "archived"])
    if (patch[k] !== undefined) values[k] = patch[k];
  if (!Object.keys(values).length) return false;
  await db
    .update(people)
    .set(values)
    .where(and(eq(people.id, rowId), eq(people.userId, userId)));
  return true;
}

export async function deletePerson(rowId: string) {
  const userId = await requireUserId();
  await db
    .delete(people)
    .where(and(eq(people.id, rowId), eq(people.userId, userId)));
  return true;
}

export async function createTransfer(patch: Record<string, unknown>) {
  const userId = await requireUserId();
  const rowId = id("tr");
  await db.insert(transfers)
    .values({
      id: rowId,
      userId,
      direction: (patch.direction as "sent") ?? "sent",
      personId: (patch.personId as string) ?? null,
      amountPaise: Number(patch.amountPaise ?? 0),
      occurredAt: String(patch.occurredAt ?? todayISO()),
      instrumentId: (patch.instrumentId as string) ?? null,
      accountId: (patch.accountId as string) ?? null,
      paymentAppSlug: (patch.paymentAppSlug as string) ?? null,
      purpose: (patch.purpose as "other") ?? "other",
      countsAsSpend: !!patch.countsAsSpend,
      settlesTransferId: (patch.settlesTransferId as string) ?? null,
      relatedExpenseId: (patch.relatedExpenseId as string) ?? null,
      note: String(patch.note ?? ""),
      createdAt: stamp(),
    });
  return rowId;
}

export async function updateTransfer(rowId: string, patch: Record<string, unknown>) {
  const userId = await requireUserId();
  const values: Record<string, unknown> = {};
  for (const k of [
    "direction", "personId", "amountPaise", "occurredAt", "instrumentId",
    "accountId", "paymentAppSlug", "purpose", "countsAsSpend", "note",
  ])
    if (patch[k] !== undefined) values[k] = patch[k];
  if (!Object.keys(values).length) return false;
  await db
    .update(transfers)
    .set(values)
    .where(and(eq(transfers.id, rowId), eq(transfers.userId, userId)));
  return true;
}

export async function deleteTransfer(rowId: string) {
  const userId = await requireUserId();
  await db
    .delete(transfers)
    .where(and(eq(transfers.id, rowId), eq(transfers.userId, userId)));
  return true;
}

/* ------------------------------------------------------------- taxonomy */

export async function createCategory(patch: Record<string, unknown>) {
  const name = String(patch.name ?? "New category");
  const slug = String(patch.slug ?? slugify(name));
  const [existing] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  if (existing) return existing.id;
  const rowId = id("cat");
  await db.insert(categories)
    .values({
      id: rowId,
      name,
      slug,
      icon: String(patch.icon ?? "Shapes"),
      colorHex: String(patch.colorHex ?? "#868E96"),
      parentSlug: (patch.parentSlug as string) ?? null,
      requiresLabel: !!patch.requiresLabel,
      isSystem: false,
      archived: false,
      sortOrder: 900,
    });
  return rowId;
}

export async function updateCategory(rowId: string, patch: Record<string, unknown>) {
  const values: Record<string, unknown> = {};
  for (const k of ["name", "icon", "colorHex", "parentSlug", "requiresLabel", "archived", "sortOrder"])
    if (patch[k] !== undefined) values[k] = patch[k];
  if (!Object.keys(values).length) return false;
  await db.update(categories).set(values).where(eq(categories.id, rowId));
  return true;
}

export async function createMerchant(patch: Record<string, unknown>) {
  const name = String(patch.name ?? "New merchant");
  const slug = String(patch.slug ?? slugify(name));
  const [existing] = await db.select().from(merchants).where(eq(merchants.slug, slug)).limit(1);
  if (existing) return existing.id;
  const rowId = id("mer");
  await db.insert(merchants)
    .values({
      id: rowId,
      name,
      slug,
      categorySlug: (patch.categorySlug as string) ?? null,
      colorHex: String(patch.colorHex ?? "#868E96"),
      isSystem: false,
    });
  return rowId;
}

export async function createPaymentApp(patch: Record<string, unknown>) {
  const name = String(patch.name ?? "New app");
  const slug = String(patch.slug ?? slugify(name));
  const [existing] = await db.select().from(paymentApps).where(eq(paymentApps.slug, slug)).limit(1);
  if (existing) return existing.id;
  const rowId = id("app");
  await db.insert(paymentApps)
    .values({
      id: rowId,
      name,
      slug,
      kind: (patch.kind as "upi") ?? "upi",
      colorHex: String(patch.colorHex ?? "#868E96"),
      isSystem: false,
      sortOrder: 900,
    });
  return rowId;
}

/* ------------------------------------------------------------------ misc */

export async function setSetting(key: string, value: string) {
  const userId = await requireUserId();
  const ownedKey = `${userId}:${key}`;
  await db.insert(settings)
    .values({ key: ownedKey, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function getSetting(key: string): Promise<string | null> {
  const userId = await requireUserId();
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, `${userId}:${key}`))
    .limit(1);
  return row?.value ?? null;
}

export async function clearTransactions() {
  const userId = await requireUserId();
  await db.transaction(async (tx) => {
    await tx.delete(adjustments).where(eq(adjustments.userId, userId));
    await tx.delete(refunds).where(eq(refunds.userId, userId));
    await tx.delete(expenses).where(eq(expenses.userId, userId));
    await tx.delete(transfers).where(eq(transfers.userId, userId));
  });
  await setSetting("demo_loaded", "no");
  return true;
}
