import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, like, or, sql } from "drizzle-orm";
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
  transfers,
} from "@/db/schema";
import type {
  Account,
  Adjustment,
  Category,
  Expense,
  Instrument,
  Merchant,
  PaymentApp,
  Person,
  Refund,
  RewardRule,
  Transfer,
} from "@/db/schema";
import { computeExpenseMath, sumMath, type ExpenseMath } from "@/lib/derive";
import { monthBounds } from "@/lib/rewards/periods";
import { capsForInstrument } from "@/lib/rewards/recompute";
import type { CapStatus } from "@/lib/rewards/engine";
import { requireUserId } from "@/lib/auth";

export interface ExpenseRow {
  expense: Expense;
  adjustments: Adjustment[];
  refunds: Refund[];
  math: ExpenseMath;
  instrument: Instrument | null;
  account: Account | null;
  category: Category | null;
  app: PaymentApp | null;
}

/* ------------------------------------------------------------- reference */

export interface Reference {
  categories: Category[];
  merchants: Merchant[];
  apps: PaymentApp[];
  instruments: Instrument[];
  accounts: Account[];
  people: Person[];
  rules: RewardRule[];
}

export async function getReference(): Promise<Reference> {
  const [categoryRows, merchantRows, appRows, instrumentRows, accountRows, peopleRows, ruleRows] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(eq(categories.archived, false))
      .orderBy(asc(categories.sortOrder)),
    db.select().from(merchants).orderBy(asc(merchants.name)),
    db
      .select()
      .from(paymentApps)
      .orderBy(asc(paymentApps.sortOrder)),
    db
      .select()
      .from(instruments)
      .where(eq(instruments.archived, false))
      .orderBy(asc(instruments.sortOrder)),
    db
      .select()
      .from(accounts)
      .where(eq(accounts.archived, false))
      .orderBy(asc(accounts.sortOrder)),
    db
      .select()
      .from(people)
      .where(eq(people.archived, false))
      .orderBy(asc(people.name)),
    db
      .select()
      .from(rewardRules)
      .orderBy(desc(rewardRules.priority)),
  ]);
  return {
    categories: categoryRows,
    merchants: merchantRows,
    apps: appRows,
    instruments: instrumentRows,
    accounts: accountRows,
    people: peopleRows,
    rules: ruleRows,
  };
}

/* -------------------------------------------------------------- expenses */

export interface ExpenseFilters {
  from?: string;
  to?: string;
  instrumentId?: string;
  accountId?: string;
  categorySlug?: string;
  appSlug?: string;
  search?: string;
  reimbursableOnly?: boolean;
  hasRefund?: boolean;
  limit?: number;
}

async function hydrate(rows: Expense[], userId: string): Promise<ExpenseRow[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [adj, ref, instrumentRows, accountRows, categoryRows, appRows] = await Promise.all([
    db
      .select()
      .from(adjustments)
      .where(and(eq(adjustments.userId, userId), inArray(adjustments.expenseId, ids))),
    db
      .select()
      .from(refunds)
      .where(and(eq(refunds.userId, userId), inArray(refunds.expenseId, ids))),
    db.select().from(instruments),
    db.select().from(accounts),
    db.select().from(categories),
    db.select().from(paymentApps),
  ]);

  const instMap = new Map(instrumentRows.map((i) => [i.id, i]));
  const acctMap = new Map(accountRows.map((a) => [a.id, a]));
  const catMap = new Map(categoryRows.map((c) => [c.slug, c]));
  const appMap = new Map(appRows.map((a) => [a.slug, a]));

  const adjBy = new Map<string, Adjustment[]>();
  for (const a of adj) {
    const list = adjBy.get(a.expenseId) ?? [];
    list.push(a);
    adjBy.set(a.expenseId, list);
  }
  const refBy = new Map<string, Refund[]>();
  for (const r of ref) {
    const list = refBy.get(r.expenseId) ?? [];
    list.push(r);
    refBy.set(r.expenseId, list);
  }

  return rows.map((expense) => {
    const instrument = expense.instrumentId
      ? (instMap.get(expense.instrumentId) ?? null)
      : null;
    const a = adjBy.get(expense.id) ?? [];
    const r = refBy.get(expense.id) ?? [];
    return {
      expense,
      adjustments: a,
      refunds: r,
      math: computeExpenseMath(
        { ...expense, unitValuePaise: instrument?.unitValuePaise ?? 100 },
        a,
        r,
      ),
      instrument,
      account: expense.accountId ? (acctMap.get(expense.accountId) ?? null) : null,
      category: catMap.get(expense.categorySlug) ?? null,
      app: expense.paymentAppSlug ? (appMap.get(expense.paymentAppSlug) ?? null) : null,
    };
  });
}

export async function listExpenses(
  f: ExpenseFilters = {},
  authenticatedUserId?: string,
): Promise<ExpenseRow[]> {
  const userId = authenticatedUserId ?? await requireUserId();
  const clauses = [eq(expenses.userId, userId)];
  if (f.from) clauses.push(gte(expenses.occurredAt, f.from));
  if (f.to) clauses.push(lte(expenses.occurredAt, f.to));
  if (f.instrumentId) clauses.push(eq(expenses.instrumentId, f.instrumentId));
  if (f.accountId) clauses.push(eq(expenses.accountId, f.accountId));
  if (f.categorySlug) clauses.push(eq(expenses.categorySlug, f.categorySlug));
  if (f.appSlug) clauses.push(eq(expenses.paymentAppSlug, f.appSlug));
  if (f.reimbursableOnly) clauses.push(eq(expenses.reimbursable, true));
  if (f.search) {
    const q = `%${f.search.toLowerCase()}%`;
    clauses.push(
      or(
        like(sql`lower(${expenses.description})`, q),
        like(sql`lower(${expenses.merchantName})`, q),
        like(sql`lower(${expenses.customLabel})`, q),
        like(sql`lower(${expenses.notes})`, q),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(expenses)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(expenses.occurredAt), desc(expenses.createdAt))
    .limit(f.limit ?? 500);

  const hydrated = await hydrate(rows, userId);
  return f.hasRefund ? hydrated.filter((r) => r.refunds.length > 0) : hydrated;
}

export async function getExpense(id: string): Promise<ExpenseRow | null> {
  const userId = await requireUserId();
  const [row] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
    .limit(1);
  if (!row) return null;
  return (await hydrate([row], userId))[0] ?? null;
}

/* --------------------------------------------------------------- summary */

export interface CardSummary {
  instrument: Instrument;
  grossPaise: number;
  netSpendPaise: number;
  rewardValuePaise: number;
  rewardUnitsMilli: number;
  rewardLostPaise: number;
  txnCount: number;
  caps: CapStatus[];
}

export interface CategorySlice {
  slug: string;
  name: string;
  colorHex: string;
  icon: string;
  netPaise: number;
  grossPaise: number;
  txnCount: number;
}

export interface DayPoint {
  date: string;
  netPaise: number;
  rewardPaise: number;
}

export interface MonthSummary {
  year: number;
  month: number;
  totals: ExpenseMath;
  txnCount: number;
  cards: CardSummary[];
  accountsSpend: { account: Account; netPaise: number; txnCount: number }[];
  byCategory: CategorySlice[];
  byApp: { slug: string; name: string; colorHex: string; netPaise: number; txnCount: number }[];
  byDay: DayPoint[];
  topMerchants: { name: string; slug: string | null; netPaise: number; txnCount: number }[];
  transfersOut: number;
  transfersIn: number;
  transferSpendPaise: number;
  previousNetPaise: number;
}

export async function getMonthSummary(
  year: number,
  month: number,
  authenticatedUserId?: string,
): Promise<MonthSummary> {
  const userId = authenticatedUserId ?? await requireUserId();
  const { start, end } = monthBounds(year, month);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prev = monthBounds(prevYear, prevMonth);
  const [rows, previousRows] = await Promise.all([
    listExpenses({ from: start, to: end, limit: 10000 }, userId),
    listExpenses({ from: prev.start, to: prev.end, limit: 10000 }, userId),
  ]);
  const totals = sumMath(rows.map((r) => r.math));
  const previousNetPaise = sumMath(
    previousRows.map((r) => r.math),
  ).netSpendPaise;

  /* cards */
  const allInstruments = await db
    .select()
    .from(instruments)
    .where(eq(instruments.archived, false))
    .orderBy(asc(instruments.sortOrder));

  const cards: CardSummary[] = await Promise.all(allInstruments.map(async (instrument) => {
    const mine = rows.filter((r) => r.expense.instrumentId === instrument.id);
    return {
      instrument,
      grossPaise: mine.reduce((s, r) => s + r.math.grossPaise, 0),
      netSpendPaise: mine.reduce((s, r) => s + r.math.netSpendPaise, 0),
      rewardValuePaise: mine.reduce((s, r) => s + r.math.rewardValuePaise, 0),
      rewardUnitsMilli: mine.reduce((s, r) => s + r.expense.rewardUnitsMilli, 0),
      rewardLostPaise: mine.reduce((s, r) => s + r.math.rewardLostToCapPaise, 0),
      txnCount: mine.length,
      caps: await capsForInstrument(instrument.id, end, userId),
    };
  }));

  /* accounts */
  const allAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.archived, false))
    .orderBy(asc(accounts.sortOrder));
  const accountsSpend = allAccounts.map((account) => {
    const mine = rows.filter((r) => r.expense.accountId === account.id);
    return {
      account,
      netPaise: mine.reduce((s, r) => s + r.math.netSpendPaise, 0),
      txnCount: mine.length,
    };
  });

  /* categories — rolled up to their top-level parent */
  const catRows = await db.select().from(categories);
  const catBySlug = new Map(catRows.map((c) => [c.slug, c]));
  const catAgg = new Map<string, CategorySlice>();
  for (const r of rows) {
    const cat = catBySlug.get(r.expense.categorySlug);
    const rootSlug = cat?.parentSlug ?? cat?.slug ?? r.expense.categorySlug;
    const root = catBySlug.get(rootSlug);
    const key = rootSlug;
    const cur =
      catAgg.get(key) ??
      {
        slug: key,
        name: root?.name ?? cat?.name ?? "Uncategorised",
        colorHex: root?.colorHex ?? "#868E96",
        icon: root?.icon ?? "Circle",
        netPaise: 0,
        grossPaise: 0,
        txnCount: 0,
      };
    cur.netPaise += r.math.netSpendPaise;
    cur.grossPaise += r.math.grossPaise;
    cur.txnCount += 1;
    catAgg.set(key, cur);
  }

  /* payment apps */
  const appRows = await db.select().from(paymentApps);
  const appBySlug = new Map(appRows.map((a) => [a.slug, a]));
  const appAgg = new Map<string, { slug: string; name: string; colorHex: string; netPaise: number; txnCount: number }>();
  for (const r of rows) {
    const slug = r.expense.paymentAppSlug ?? "unspecified";
    const app = appBySlug.get(slug);
    const cur =
      appAgg.get(slug) ??
      { slug, name: app?.name ?? "Not recorded", colorHex: app?.colorHex ?? "#CED4DA", netPaise: 0, txnCount: 0 };
    cur.netPaise += r.math.netSpendPaise;
    cur.txnCount += 1;
    appAgg.set(slug, cur);
  }

  /* by day */
  const dayAgg = new Map<string, DayPoint>();
  const lastDay = Number(end.slice(8, 10));
  for (let d = 1; d <= lastDay; d++) {
    const key = `${end.slice(0, 8)}${String(d).padStart(2, "0")}`;
    dayAgg.set(key, { date: key, netPaise: 0, rewardPaise: 0 });
  }
  for (const r of rows) {
    const point = dayAgg.get(r.expense.occurredAt);
    if (point) {
      point.netPaise += r.math.netSpendPaise;
      point.rewardPaise += r.math.rewardValuePaise;
    }
  }

  /* merchants */
  const merchAgg = new Map<string, { name: string; slug: string | null; netPaise: number; txnCount: number }>();
  for (const r of rows) {
    const name = r.expense.merchantName || r.expense.description || "Unnamed";
    const key = r.expense.merchantSlug ?? name.toLowerCase();
    const cur = merchAgg.get(key) ?? { name, slug: r.expense.merchantSlug, netPaise: 0, txnCount: 0 };
    cur.netPaise += r.math.netSpendPaise;
    cur.txnCount += 1;
    merchAgg.set(key, cur);
  }

  /* transfers */
  const monthTransfers = await db
    .select()
    .from(transfers)
    .where(
      and(
        eq(transfers.userId, userId),
        gte(transfers.occurredAt, start),
        lte(transfers.occurredAt, end),
      ),
    );
  const transfersOut = monthTransfers
    .filter((t) => t.direction === "sent")
    .reduce((s, t) => s + t.amountPaise, 0);
  const transfersIn = monthTransfers
    .filter((t) => t.direction === "received")
    .reduce((s, t) => s + t.amountPaise, 0);
  const transferSpendPaise = monthTransfers
    .filter((t) => t.direction === "sent" && t.countsAsSpend)
    .reduce((s, t) => s + t.amountPaise, 0);

  return {
    year,
    month,
    totals,
    txnCount: rows.length,
    cards,
    accountsSpend,
    byCategory: [...catAgg.values()].sort((a, b) => b.netPaise - a.netPaise),
    byApp: [...appAgg.values()].sort((a, b) => b.netPaise - a.netPaise),
    byDay: [...dayAgg.values()],
    topMerchants: [...merchAgg.values()]
      .sort((a, b) => b.netPaise - a.netPaise)
      .slice(0, 8),
    transfersOut,
    transfersIn,
    transferSpendPaise,
    previousNetPaise,
  };
}

/* ---------------------------------------------------------------- people */

export interface PersonBalance {
  person: Person;
  sentPaise: number;
  receivedPaise: number;
  /** Positive = they owe you. Negative = you owe them. */
  netPaise: number;
  lendingOutstandingPaise: number;
  lastActivity: string | null;
  transferCount: number;
}

export async function getPeopleBalances(): Promise<PersonBalance[]> {
  const userId = await requireUserId();
  const allPeople = await db
    .select()
    .from(people)
    .where(eq(people.archived, false))
    .orderBy(asc(people.name));
  const allTransfers = await db
    .select()
    .from(transfers)
    .where(eq(transfers.userId, userId));

  return allPeople.map((person) => {
    const mine = allTransfers.filter((t) => t.personId === person.id);
    const sentPaise = mine
      .filter((t) => t.direction === "sent")
      .reduce((s, t) => s + t.amountPaise, 0);
    const receivedPaise = mine
      .filter((t) => t.direction === "received")
      .reduce((s, t) => s + t.amountPaise, 0);
    // Gifts and your own share of a split are not debts.
    const lendable = mine.filter((t) => !t.countsAsSpend && t.purpose !== "gift");
    const lentOut = lendable
      .filter((t) => t.direction === "sent")
      .reduce((s, t) => s + t.amountPaise, 0);
    const paidBack = lendable
      .filter((t) => t.direction === "received")
      .reduce((s, t) => s + t.amountPaise, 0);
    const dates = mine.map((t) => t.occurredAt).sort();
    return {
      person,
      sentPaise,
      receivedPaise,
      netPaise: lentOut - paidBack,
      lendingOutstandingPaise: Math.max(0, lentOut - paidBack),
      lastActivity: dates.length ? dates[dates.length - 1] : null,
      transferCount: mine.length,
    };
  });
}

export async function listTransfers(limit = 200): Promise<(Transfer & {
  personName: string;
  personColor: string;
})[]> {
  const userId = await requireUserId();
  const peopleRows = await db.select().from(people);
  const peopleMap = new Map(peopleRows.map((p) => [p.id, p]));
  const rows = await db
    .select()
    .from(transfers)
    .where(eq(transfers.userId, userId))
    .orderBy(desc(transfers.occurredAt), desc(transfers.createdAt))
    .limit(limit);
  return rows.map((t) => ({
      ...t,
      personName: (t.personId && peopleMap.get(t.personId)?.name) || "Someone",
      personColor: (t.personId && peopleMap.get(t.personId)?.colorHex) || "#868E96",
    }));
}

/* --------------------------------------------------------------- pending */

export interface PendingSummary {
  reimbursements: ExpenseRow[];
  refunds: ExpenseRow[];
  reimbursementOutstandingPaise: number;
  refundPendingPaise: number;
  lendingOutstandingPaise: number;
}

export async function getPending(): Promise<PendingSummary> {
  const userId = await requireUserId();
  const reimbursementRows = await hydrate(
    await db
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          eq(expenses.reimbursable, true),
          inArray(expenses.reimbursementStatus, ["pending", "partial"]),
        ),
      )
      .orderBy(asc(expenses.reimbursementDueDate), desc(expenses.occurredAt)),
    userId,
  );

  const pendingRefundIds = (await db
    .select({ id: refunds.expenseId })
    .from(refunds)
    .where(and(eq(refunds.userId, userId), eq(refunds.status, "pending"))))
    .map((r) => r.id);
  const refundRows = pendingRefundIds.length
    ? await hydrate(
        await db
          .select()
          .from(expenses)
          .where(
            and(
              eq(expenses.userId, userId),
              inArray(expenses.id, pendingRefundIds),
            ),
          ),
        userId,
      )
    : [];

  const balances = await getPeopleBalances();

  return {
    reimbursements: reimbursementRows,
    refunds: refundRows,
    reimbursementOutstandingPaise: reimbursementRows.reduce(
      (s, r) => s + r.math.reimbursementOutstandingPaise,
      0,
    ),
    refundPendingPaise: refundRows.reduce((s, r) => s + r.math.refundPendingPaise, 0),
    lendingOutstandingPaise: balances.reduce(
      (s, b) => s + b.lendingOutstandingPaise,
      0,
    ),
  };
}

/* ----------------------------------------------------------------- cards */

export async function getInstrumentDetail(id: string) {
  const [instrument] = await db.select().from(instruments).where(eq(instruments.id, id)).limit(1);
  if (!instrument) return null;
  const rules = await db
    .select()
    .from(rewardRules)
    .where(eq(rewardRules.instrumentId, id))
    .orderBy(desc(rewardRules.priority), asc(rewardRules.name));
  return { instrument, rules };
}

export async function getYearRewardTrend(instrumentId: string, year: number) {
  const out: { month: number; rewardPaise: number; netPaise: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const { start, end } = monthBounds(year, m);
    const rows = await listExpenses({ from: start, to: end, instrumentId, limit: 10000 });
    out.push({
      month: m,
      rewardPaise: rows.reduce((s, r) => s + r.math.rewardValuePaise, 0),
      netPaise: rows.reduce((s, r) => s + r.math.netSpendPaise, 0),
    });
  }
  return out;
}
