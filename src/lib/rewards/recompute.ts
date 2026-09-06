import "server-only";
import { and, asc, eq, gte, lte, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses, instruments, refunds, rewardRules } from "@/db/schema";
import type { Instrument, RewardRule, Expense } from "@/db/schema";
import {
  evaluateExpense,
  newCapLedger,
  capStatusFor,
  type CapLedger,
  type EngineInstrument,
  type EngineRule,
  type EngineExpense,
  type CapStatus,
} from "./engine";
import { yearBounds, periodKey } from "./periods";
import type { CapPeriod } from "./periods";
import { requireUserId } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fromSupabaseRows, toSupabaseRow } from "@/lib/supabase/rows";

function json<T>(raw: string, fallback: T): T {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function toEngineInstrument(row: Instrument): EngineInstrument {
  return {
    id: row.id,
    shortName: row.shortName,
    statementDay: row.statementDay,
    rewardUnit: row.rewardUnit,
    unitValuePaise: row.unitValuePaise,
    overallCapUnits: row.overallCapUnits ?? null,
    overallCapPeriod: row.overallCapPeriod as CapPeriod,
    excludedCategories: json<string[]>(row.excludedCategories, []),
    defaultFlags: defaultFlagsFor(row),
  };
}

/** Card conditions declare their own fallback, e.g. "Prime: yes by default". */
export function cardFlagDefinitions(row: Instrument): {
  key: string;
  label: string;
  hint?: string;
  default: boolean;
}[] {
  const options = json<Record<string, unknown>>(row.options, {});
  const flags = options.flags;
  return Array.isArray(flags)
    ? (flags as { key: string; label: string; hint?: string; default: boolean }[])
    : [];
}

function defaultFlagsFor(row: Instrument): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const flag of cardFlagDefinitions(row)) out[flag.key] = !!flag.default;
  return out;
}

export function toEngineRule(row: RewardRule): EngineRule {
  return {
    id: row.id,
    name: row.name,
    priority: row.priority,
    isBase: row.isBase,
    matchMerchants: json<string[]>(row.matchMerchants, []),
    matchCategories: json<string[]>(row.matchCategories, []),
    matchApps: json<string[]>(row.matchApps, []),
    channel: row.channel,
    rateType: row.rateType,
    rateBps: row.rateBps,
    blockSizePaise: row.blockSizePaise,
    pointsPerBlock: row.pointsPerBlock,
    minTxnPaise: row.minTxnPaise,
    maxTxnPaise: row.maxTxnPaise ?? null,
    capUnits: row.capUnits ?? null,
    capPeriod: row.capPeriod as CapPeriod,
    capGroup: row.capGroup,
    excludeCategories: json<string[]>(row.excludeCategories, []),
    excludeMerchants: json<string[]>(row.excludeMerchants, []),
    requiresFlag: row.requiresFlag ?? null,
    requiresFlagValue: row.requiresFlagValue,
    validFrom: row.validFrom ?? null,
    validTo: row.validTo ?? null,
    active: row.active,
  };
}

function toEngineExpense(row: Expense, refundedPaise: number): EngineExpense {
  return {
    id: row.id,
    occurredAt: row.occurredAt,
    eligiblePaise: Math.max(0, row.amountPaise - refundedPaise),
    categorySlug: row.categorySlug,
    merchantSlug: row.merchantSlug ?? null,
    paymentAppSlug: row.paymentAppSlug ?? null,
    channel: row.channel,
    flags: json<Record<string, boolean>>(row.flags, {}),
  };
}

/** Sum of received refunds keyed by expense id. */
async function refundMap(
  expenseIds: string[],
  userId: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!expenseIds.length) return map;
  const result = await createSupabaseAdminClient()
    .from("refunds")
    .select("*")
    .eq("user_id", userId)
    .in("expense_id", expenseIds);
  if (result.error) throw result.error;
  const rows = fromSupabaseRows<typeof refunds.$inferSelect>(result.data);
  for (const r of rows) {
    if (r.status !== "received") continue;
    map.set(r.expenseId, (map.get(r.expenseId) ?? 0) + r.amountPaise);
  }
  return map;
}

/**
 * Replay every expense on one card for one calendar year in date order and
 * write the resulting rewards back. Caps are consumed in the same sequence the
 * issuer would consume them, so a late-month purchase correctly earns nothing
 * once the cap is gone.
 */
export async function recomputeInstrumentYear(instrumentId: string, year: number) {
  const userId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const { start, end } = yearBounds(year);
  const [instrumentResult, ruleResult, expenseResult] = await Promise.all([
    admin.from("instruments").select("*").eq("id", instrumentId).maybeSingle(),
    admin.from("reward_rules").select("*").eq("instrument_id", instrumentId),
    admin
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .eq("instrument_id", instrumentId)
      .gte("occurred_at", start)
      .lte("occurred_at", end)
      .order("occurred_at")
      .order("created_at")
      .order("id"),
  ]);
  const error = [instrumentResult, ruleResult, expenseResult]
    .find((result) => result.error)?.error;
  if (error) throw error;
  const [inst] = fromSupabaseRows<Instrument>(
    instrumentResult.data ? [instrumentResult.data] : [],
  );
  if (!inst) return;

  const rules = fromSupabaseRows<RewardRule>(ruleResult.data).map(toEngineRule);
  const rows = fromSupabaseRows<Expense>(expenseResult.data);

  const engineInst = toEngineInstrument(inst);
  const refunded = await refundMap(rows.map((r) => r.id), userId);
  const ledger = newCapLedger();

  const updates = rows.map((row) => {
    const outcome = evaluateExpense(
      engineInst,
      rules,
      toEngineExpense(row, refunded.get(row.id) ?? 0),
      ledger,
    );
    const overridden = row.rewardOverridePaise != null;
    return {
      id: row.id,
      values: toSupabaseRow({
        rewardRuleId: outcome.ruleId,
        rewardUnitsMilli: outcome.unitsMilli,
        rewardValuePaise: overridden
          ? row.rewardOverridePaise!
          : outcome.valuePaise,
        rewardCappedUnitsMilli: outcome.cappedUnitsMilli,
        rewardExplain: overridden
          ? `Manual override - engine said ${outcome.explain}`
          : outcome.explain,
      }),
    };
  });

  const updateResults = await Promise.all(
    updates.map(({ id, values }) =>
      admin
        .from("expenses")
        .update(values)
        .eq("id", id)
        .eq("user_id", userId),
    ),
  );
  const updateError = updateResults.find((result) => result.error)?.error;
  if (updateError) throw updateError;
}

/** Recompute every card touched by a date, plus neighbours for safety. */
export async function recomputeForDate(instrumentId: string | null, dateISO: string) {
  if (!instrumentId) return;
  const year = Number(dateISO.slice(0, 4));
  await recomputeInstrumentYear(instrumentId, year);
}

export async function recomputeAll(year?: number) {
  const y = year ?? new Date().getFullYear();
  const all = await db.select().from(instruments);
  for (const inst of all) await recomputeInstrumentYear(inst.id, y);
}

/** Build a cap ledger for reporting without writing anything. */
export async function capLedgerFor(
  instrumentId: string,
  year: number,
  authenticatedUserId?: string,
): Promise<{ ledger: CapLedger; inst: EngineInstrument; rules: EngineRule[] } | null> {
  const userId = authenticatedUserId ?? await requireUserId();
  const [inst] = await db
    .select()
    .from(instruments)
    .where(eq(instruments.id, instrumentId))
    .limit(1);
  if (!inst) return null;

  const rules = (await db
    .select()
    .from(rewardRules)
    .where(eq(rewardRules.instrumentId, instrumentId)))
    .map(toEngineRule);

  const { start, end } = yearBounds(year);
  const rows = await db
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.userId, userId),
        eq(expenses.instrumentId, instrumentId),
        gte(expenses.occurredAt, start),
        lte(expenses.occurredAt, end),
      ),
    )
    .orderBy(asc(expenses.occurredAt), asc(expenses.createdAt), asc(expenses.id));

  const engineInst = toEngineInstrument(inst);
  const refunded = await refundMap(rows.map((r) => r.id), userId);
  const ledger = newCapLedger();
  for (const row of rows) {
    evaluateExpense(
      engineInst,
      rules,
      toEngineExpense(row, refunded.get(row.id) ?? 0),
      ledger,
    );
  }
  return { ledger, inst: engineInst, rules };
}

export async function capsForInstrument(
  instrumentId: string,
  dateISO: string,
  authenticatedUserId?: string,
): Promise<CapStatus[]> {
  const built = await capLedgerFor(
    instrumentId,
    Number(dateISO.slice(0, 4)),
    authenticatedUserId,
  );
  if (!built) return [];
  return capStatusFor(built.inst, built.rules, built.ledger, dateISO);
}

// Build cap status for every card in three database reads. The dashboard used
// to replay each card separately, multiplying Supabase round trips by the
// number of cards and regularly exceeding Vercel's client timeout.
export async function capsForInstruments(
  instrumentRows: Instrument[],
  dateISO: string,
  authenticatedUserId: string,
): Promise<Map<string, CapStatus[]>> {
  const result = new Map<string, CapStatus[]>();
  if (!instrumentRows.length) return result;

  const ids = instrumentRows.map((instrument) => instrument.id);
  const { start, end } = yearBounds(Number(dateISO.slice(0, 4)));
  const admin = createSupabaseAdminClient();
  const [ruleResult, expenseResult] = await Promise.all([
    admin.from("reward_rules").select("*").in("instrument_id", ids),
    admin
      .from("expenses")
      .select("*")
      .eq("user_id", authenticatedUserId)
      .in("instrument_id", ids)
      .gte("occurred_at", start)
      .lte("occurred_at", end)
      .order("occurred_at")
      .order("created_at")
      .order("id"),
  ]);
  if (ruleResult.error) throw ruleResult.error;
  if (expenseResult.error) throw expenseResult.error;
  const ruleRows = fromSupabaseRows<RewardRule>(ruleResult.data);
  const expenseRows = fromSupabaseRows<Expense>(expenseResult.data);
  const refunded = await refundMap(
    expenseRows.map((expense) => expense.id),
    authenticatedUserId,
  );

  const rulesByInstrument = new Map<string, EngineRule[]>();
  for (const row of ruleRows) {
    const rules = rulesByInstrument.get(row.instrumentId) ?? [];
    rules.push(toEngineRule(row));
    rulesByInstrument.set(row.instrumentId, rules);
  }

  const expensesByInstrument = new Map<string, Expense[]>();
  for (const row of expenseRows) {
    if (!row.instrumentId) continue;
    const rows = expensesByInstrument.get(row.instrumentId) ?? [];
    rows.push(row);
    expensesByInstrument.set(row.instrumentId, rows);
  }

  for (const row of instrumentRows) {
    const instrument = toEngineInstrument(row);
    const rules = rulesByInstrument.get(row.id) ?? [];
    const ledger = newCapLedger();
    for (const expense of expensesByInstrument.get(row.id) ?? []) {
      evaluateExpense(
        instrument,
        rules,
        toEngineExpense(expense, refunded.get(expense.id) ?? 0),
        ledger,
      );
    }
    result.set(row.id, capStatusFor(instrument, rules, ledger, dateISO));
  }

  return result;
}

/**
 * What would this spend earn right now? Runs the engine against a live ledger
 * without persisting, so the expense form can preview before you save.
 */
export async function previewReward(input: {
  instrumentId: string;
  amountPaise: number;
  occurredAt: string;
  categorySlug: string;
  merchantSlug: string | null;
  paymentAppSlug: string | null;
  channel: "online" | "offline" | "upi";
  flags?: Record<string, boolean>;
  excludeExpenseId?: string;
}) {
  const userId = await requireUserId();
  const built = await capLedgerFor(input.instrumentId, Number(input.occurredAt.slice(0, 4)));
  if (!built) return null;

  // If we are editing an existing expense, roll its consumption back out first.
  if (input.excludeExpenseId) {
    const [existing] = await db
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.id, input.excludeExpenseId),
          eq(expenses.userId, userId),
        ),
      )
      .limit(1);
    if (existing?.rewardUnitsMilli) {
      const rule = built.rules.find((r) => r.id === existing.rewardRuleId);
      if (rule) {
        const groupKey = rule.capGroup || rule.id;
        const key = `rule:${groupKey}:${periodKey(rule.capPeriod, existing.occurredAt, built.inst.statementDay)}`;
        built.ledger.set(
          key,
          Math.max(0, (built.ledger.get(key) ?? 0) - existing.rewardUnitsMilli),
        );
      }
    }
  }

  const outcome = evaluateExpense(
    built.inst,
    built.rules,
    {
      id: "preview",
      occurredAt: input.occurredAt,
      eligiblePaise: input.amountPaise,
      categorySlug: input.categorySlug,
      merchantSlug: input.merchantSlug,
      paymentAppSlug: input.paymentAppSlug,
      channel: input.channel,
      flags: input.flags ?? {},
    },
    built.ledger,
  );

  return {
    ...outcome,
    rewardUnit: built.inst.rewardUnit,
    unitValuePaise: built.inst.unitValuePaise,
    caps: capStatusFor(built.inst, built.rules, built.ledger, input.occurredAt),
  };
}
