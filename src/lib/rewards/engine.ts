import { MILLI } from "../money";
import { periodKey, type CapPeriod } from "./periods";

/* ------------------------------------------------------------------ types */

export interface EngineInstrument {
  id: string;
  shortName: string;
  statementDay: number;
  rewardUnit: string;
  unitValuePaise: number;
  overallCapUnits: number | null;
  overallCapPeriod: CapPeriod;
  excludedCategories: string[];
  /** Fallback answers for card conditions when an expense doesn't carry one. */
  defaultFlags: Record<string, boolean>;
}

export interface EngineRule {
  id: string;
  name: string;
  priority: number;
  isBase: boolean;
  matchMerchants: string[];
  matchCategories: string[];
  matchApps: string[];
  channel: "any" | "online" | "offline" | "upi";
  rateType: "percent" | "points_per_block";
  rateBps: number;
  blockSizePaise: number;
  pointsPerBlock: number;
  minTxnPaise: number;
  maxTxnPaise: number | null;
  capUnits: number | null;
  capPeriod: CapPeriod;
  capGroup: string;
  excludeCategories: string[];
  excludeMerchants: string[];
  requiresFlag: string | null;
  requiresFlagValue: boolean;
  validFrom: string | null;
  validTo: string | null;
  active: boolean;
}

export interface EngineExpense {
  id: string;
  occurredAt: string;
  /** Reward-eligible amount: gross spend minus received refunds. */
  eligiblePaise: number;
  categorySlug: string;
  merchantSlug: string | null;
  paymentAppSlug: string | null;
  channel: "online" | "offline" | "upi";
  /** e.g. { primeMember: true } — answered when the expense was filed. */
  flags: Record<string, boolean>;
}

export interface RewardOutcome {
  ruleId: string | null;
  ruleName: string;
  unitsMilli: number;
  valuePaise: number;
  cappedUnitsMilli: number;
  explain: string;
}

/** Mutable cap ledger, carried across a chronological pass over expenses. */
export type CapLedger = Map<string, number>;

export function newCapLedger(): CapLedger {
  return new Map();
}

/* --------------------------------------------------------------- matching */

const SPECIFICITY = {
  merchant: 500,
  app: 400,
  category: 300,
  channel: 150,
  base: 0,
} as const;

function withinDates(rule: EngineRule, dateISO: string): boolean {
  if (rule.validFrom && dateISO < rule.validFrom) return false;
  if (rule.validTo && dateISO > rule.validTo) return false;
  return true;
}

function channelMatches(rule: EngineRule, expense: EngineExpense): boolean {
  if (rule.channel === "any") return true;
  return rule.channel === expense.channel;
}

/** What the expense said, falling back to the card's own default. */
export function resolveFlag(
  key: string,
  expense: EngineExpense,
  defaults: Record<string, boolean>,
): boolean {
  const own = expense.flags?.[key];
  if (typeof own === "boolean") return own;
  return defaults[key] ?? false;
}

/**
 * Score a rule against an expense. Returns null when the rule does not apply.
 * A higher score is a more specific rule and wins.
 */
export function scoreRule(
  rule: EngineRule,
  expense: EngineExpense,
  defaultFlags: Record<string, boolean> = {},
): number | null {
  if (!rule.active) return null;
  if (
    rule.requiresFlag &&
    resolveFlag(rule.requiresFlag, expense, defaultFlags) !== rule.requiresFlagValue
  )
    return null;
  if (!withinDates(rule, expense.occurredAt)) return null;
  if (expense.eligiblePaise < rule.minTxnPaise) return null;
  if (rule.maxTxnPaise != null && expense.eligiblePaise > rule.maxTxnPaise)
    return null;
  if (rule.excludeCategories.includes(expense.categorySlug)) return null;
  if (
    expense.merchantSlug &&
    rule.excludeMerchants.includes(expense.merchantSlug)
  )
    return null;
  if (!channelMatches(rule, expense)) return null;

  let score = 0;
  let matchedSomething = false;

  if (rule.matchMerchants.length) {
    if (!expense.merchantSlug || !rule.matchMerchants.includes(expense.merchantSlug))
      return null;
    score += SPECIFICITY.merchant;
    matchedSomething = true;
  }
  if (rule.matchApps.length) {
    if (!expense.paymentAppSlug || !rule.matchApps.includes(expense.paymentAppSlug))
      return null;
    score += SPECIFICITY.app;
    matchedSomething = true;
  }
  if (rule.matchCategories.length) {
    if (!rule.matchCategories.includes(expense.categorySlug)) return null;
    score += SPECIFICITY.category;
    matchedSomething = true;
  }
  if (rule.channel !== "any") {
    score += SPECIFICITY.channel;
    matchedSomething = true;
  }
  if (!matchedSomething && !rule.isBase) return null;

  return score + rule.priority;
}

export function pickRule(
  rules: EngineRule[],
  expense: EngineExpense,
  defaultFlags: Record<string, boolean> = {},
): EngineRule | null {
  let best: EngineRule | null = null;
  let bestScore = -Infinity;
  for (const rule of rules) {
    const score = scoreRule(rule, expense, defaultFlags);
    if (score == null) continue;
    if (
      score > bestScore ||
      (score === bestScore && best && effectiveBps(rule) > effectiveBps(best))
    ) {
      best = rule;
      bestScore = score;
    }
  }
  return best;
}

/** Approximate earn rate in basis points, used only to break ties. */
function effectiveBps(rule: EngineRule): number {
  if (rule.rateType === "percent") return rule.rateBps;
  if (!rule.blockSizePaise) return 0;
  return Math.round((rule.pointsPerBlock / rule.blockSizePaise) * 10000 * 100);
}

/* -------------------------------------------------------------- computing */

function grossUnitsMilli(
  rule: EngineRule,
  instrument: EngineInstrument,
  eligiblePaise: number,
): number {
  if (rule.rateType === "percent") {
    const valuePaise = (eligiblePaise * rule.rateBps) / 10000;
    return Math.round((valuePaise * MILLI) / Math.max(instrument.unitValuePaise, 1));
  }
  const blocks = Math.floor(eligiblePaise / Math.max(rule.blockSizePaise, 1));
  return blocks * rule.pointsPerBlock * MILLI;
}

function applyCap(
  ledger: CapLedger,
  key: string,
  capUnits: number | null,
  wantMilli: number,
): { granted: number; capped: number } {
  if (capUnits == null) {
    ledger.set(key, (ledger.get(key) ?? 0) + wantMilli);
    return { granted: wantMilli, capped: 0 };
  }
  const capMilli = capUnits * MILLI;
  const used = ledger.get(key) ?? 0;
  const room = Math.max(0, capMilli - used);
  const granted = Math.min(wantMilli, room);
  ledger.set(key, used + granted);
  return { granted, capped: wantMilli - granted };
}

/**
 * Evaluate one expense. `ledger` is mutated so that a chronological pass
 * naturally exhausts caps in transaction order, the way an issuer does it.
 */
export function evaluateExpense(
  instrument: EngineInstrument,
  rules: EngineRule[],
  expense: EngineExpense,
  ledger: CapLedger,
): RewardOutcome {
  const none = (explain: string): RewardOutcome => ({
    ruleId: null,
    ruleName: "",
    unitsMilli: 0,
    valuePaise: 0,
    cappedUnitsMilli: 0,
    explain,
  });

  if (expense.eligiblePaise <= 0) return none("Fully refunded — nothing to earn on.");

  if (instrument.excludedCategories.includes(expense.categorySlug))
    return none(
      `${instrument.shortName} does not pay rewards on this category.`,
    );

  const rule = pickRule(rules, expense, instrument.defaultFlags ?? {});
  if (!rule) return none("No reward rule matches this spend.");

  const gross = grossUnitsMilli(rule, instrument, expense.eligiblePaise);
  if (gross <= 0)
    return none(`${rule.name} matched but earns nothing at this amount.`);

  // Per-rule (or shared group) cap first, then the card-wide cap.
  const groupKey = rule.capGroup || rule.id;
  const ruleKey = `rule:${groupKey}:${periodKey(rule.capPeriod, expense.occurredAt, instrument.statementDay)}`;
  const first = applyCap(ledger, ruleKey, rule.capUnits, gross);

  let granted = first.granted;
  let capped = first.capped;
  let cappedBy = capped > 0 ? rule.capPeriod : null;

  if (instrument.overallCapUnits != null && granted > 0) {
    const cardKey = `card:${instrument.id}:${periodKey(instrument.overallCapPeriod, expense.occurredAt, instrument.statementDay)}`;
    const second = applyCap(
      ledger,
      cardKey,
      instrument.overallCapUnits,
      granted,
    );
    if (second.capped > 0) {
      // Hand the unearned portion back to the rule bucket.
      ledger.set(ruleKey, (ledger.get(ruleKey) ?? 0) - second.capped);
      capped += second.capped;
      cappedBy = instrument.overallCapPeriod;
    }
    granted = second.granted;
  }

  const valuePaise = Math.round(
    (granted * instrument.unitValuePaise) / MILLI,
  );

  const rateText =
    rule.rateType === "percent"
      ? `${rule.rateBps / 100}%`
      : `${rule.pointsPerBlock} pt per ₹${rule.blockSizePaise / 100}`;

  let explain = `${rule.name} · ${rateText}`;
  if (capped > 0) {
    explain += ` · cap reached, ${(capped / MILLI).toFixed(2)} ${instrument.rewardUnit} not earned ${cappedBy === "statement" ? "this cycle" : `this ${cappedBy}`}`;
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    unitsMilli: granted,
    valuePaise,
    cappedUnitsMilli: capped,
    explain,
  };
}

/* --------------------------------------------------------- cap reporting */

export interface CapStatus {
  ruleId: string;
  ruleName: string;
  capUnits: number;
  capPeriod: CapPeriod;
  usedUnits: number;
  remainingUnits: number;
  pctUsed: number;
  /** Spend that would exhaust the remaining headroom, in paise. */
  headroomSpendPaise: number | null;
}

export function capStatusFor(
  instrument: EngineInstrument,
  rules: EngineRule[],
  ledger: CapLedger,
  dateISO: string,
): CapStatus[] {
  const seen = new Set<string>();
  const out: CapStatus[] = [];
  for (const rule of rules) {
    if (rule.capUnits == null || rule.capPeriod === "none" || !rule.active)
      continue;
    const groupKey = rule.capGroup || rule.id;
    if (seen.has(groupKey + rule.capPeriod)) continue;
    seen.add(groupKey + rule.capPeriod);

    const key = `rule:${groupKey}:${periodKey(rule.capPeriod, dateISO, instrument.statementDay)}`;
    const usedMilli = ledger.get(key) ?? 0;
    const usedUnits = usedMilli / MILLI;
    const remainingUnits = Math.max(0, rule.capUnits - usedUnits);

    let headroomSpendPaise: number | null = null;
    if (rule.rateType === "percent" && rule.rateBps > 0) {
      const remainingPaise =
        (remainingUnits * instrument.unitValuePaise);
      headroomSpendPaise = Math.round((remainingPaise * 10000) / rule.rateBps);
    }

    out.push({
      ruleId: rule.id,
      ruleName: rule.name,
      capUnits: rule.capUnits,
      capPeriod: rule.capPeriod,
      usedUnits,
      remainingUnits,
      pctUsed: rule.capUnits ? Math.min(100, (usedUnits / rule.capUnits) * 100) : 0,
      headroomSpendPaise,
    });
  }
  return out;
}
