import "server-only";
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
  StandaloneReimbursement,
  StandaloneReimbursementReceipt,
  Transfer,
} from "@/db/schema";
import { computeExpenseMath, sumMath, type ExpenseMath } from "@/lib/derive";
import { monthBounds } from "@/lib/rewards/periods";
import { capsForInstruments } from "@/lib/rewards/recompute";
import { rewardAutomationEnabled } from "@/lib/rewards/coverage";
import type { CapStatus } from "@/lib/rewards/engine";
import { requireUserId } from "@/lib/auth";
import {
  deriveStandaloneReimbursementState,
  type StandaloneReimbursementStatus,
} from "@/lib/reimbursements";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fromSupabaseRows } from "@/lib/supabase/rows";

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

/**
 * The service-role client bypasses RLS, so every taxonomy read must explicitly
 * include only shared system rows or rows owned by the authenticated user.
 * Supabase Auth user IDs are UUIDs and therefore safe in this PostgREST filter.
 */
function accessibleTaxonomyFilter(userId: string) {
  return `is_system.eq.true,owner_user_id.eq.${userId}`;
}

function accessibleInstrumentFilter(userId: string) {
  return `is_catalog_card.eq.true,owner_user_id.eq.${userId}`;
}

export async function getReference(
  authenticatedUserId?: string,
): Promise<Reference> {
  const userId = authenticatedUserId ?? await requireUserId();
  const admin = createSupabaseAdminClient();
  const [selectionResult, onboardingResult] = await Promise.all([
    admin
      .from("user_card_selections")
      .select("instrument_id")
      .eq("user_id", userId),
    admin
      .from("user_onboarding")
      .select("cards_completed_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const selectionError = selectionResult.error ?? onboardingResult.error;
  if (selectionError) throw selectionError;
  const walletConfirmed = Boolean(onboardingResult.data?.cards_completed_at);
  const selectedInstrumentIds = [
    ...new Set(
      (selectionResult.data ?? [])
        .map((row) => row.instrument_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const accessibleInstrumentIds = walletConfirmed ? selectedInstrumentIds : [];
  const results = await Promise.all([
    admin
      .from("categories")
      .select("*")
      .or(accessibleTaxonomyFilter(userId))
      .eq("archived", false)
      .order("sort_order"),
    admin
      .from("merchants")
      .select("*")
      .or(accessibleTaxonomyFilter(userId))
      .order("name"),
    admin
      .from("payment_apps")
      .select("*")
      .or(accessibleTaxonomyFilter(userId))
      .order("sort_order"),
    accessibleInstrumentIds.length
      ? admin
          .from("instruments")
          .select("*")
          .in("id", accessibleInstrumentIds)
          .or(accessibleInstrumentFilter(userId))
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    admin
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("sort_order"),
    admin
      .from("people")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("name"),
    accessibleInstrumentIds.length
      ? admin
          .from("reward_rules")
          .select("*")
          .in("instrument_id", accessibleInstrumentIds)
          .order("priority", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
  const [
    categoryResult,
    merchantResult,
    appResult,
    instrumentResult,
    accountResult,
    peopleResult,
    ruleResult,
  ] = results;
  const instrumentRows = fromSupabaseRows<Instrument>(instrumentResult.data);
  const automatedInstrumentIds = new Set(
    instrumentRows.filter(rewardAutomationEnabled).map(({ id }) => id),
  );
  return {
    categories: fromSupabaseRows<Category>(categoryResult.data),
    merchants: fromSupabaseRows<Merchant>(merchantResult.data),
    apps: fromSupabaseRows<PaymentApp>(appResult.data),
    instruments: instrumentRows,
    accounts: fromSupabaseRows<Account>(accountResult.data),
    people: fromSupabaseRows<Person>(peopleResult.data),
    rules: fromSupabaseRows<RewardRule>(ruleResult.data).filter((rule) =>
      automatedInstrumentIds.has(rule.instrumentId),
    ),
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

interface HydrationReference {
  instruments: Instrument[];
  accounts: Account[];
  categories: Category[];
  apps: PaymentApp[];
}

async function hydrate(
  rows: Expense[],
  userId: string,
  reference?: HydrationReference,
): Promise<ExpenseRow[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const instrumentIds = [
    ...new Set(rows.map((row) => row.instrumentId).filter(Boolean)),
  ] as string[];
  const accountIds = [
    ...new Set(rows.map((row) => row.accountId).filter(Boolean)),
  ] as string[];
  const categorySlugs = [...new Set(rows.map((row) => row.categorySlug))];
  const appSlugs = [
    ...new Set(rows.map((row) => row.paymentAppSlug).filter(Boolean)),
  ] as string[];
  const admin = createSupabaseAdminClient();
  const results = await Promise.all([
    admin.from("adjustments").select("*").eq("user_id", userId).in("expense_id", ids),
    admin.from("refunds").select("*").eq("user_id", userId).in("expense_id", ids),
    reference?.instruments
      ? Promise.resolve({ data: reference.instruments, error: null, mapped: true })
      : instrumentIds.length
        ? admin
            .from("instruments")
            .select("*")
            .in("id", instrumentIds)
            .or(accessibleInstrumentFilter(userId))
        : Promise.resolve({ data: [], error: null }),
    reference?.accounts
      ? Promise.resolve({ data: reference.accounts, error: null, mapped: true })
      : accountIds.length
        ? admin
            .from("accounts")
            .select("*")
            .in("id", accountIds)
            .eq("user_id", userId)
        : Promise.resolve({ data: [], error: null }),
    reference?.categories
      ? Promise.resolve({ data: reference.categories, error: null, mapped: true })
      : admin
          .from("categories")
          .select("*")
          .in("slug", categorySlugs)
          .or(accessibleTaxonomyFilter(userId)),
    reference?.apps
      ? Promise.resolve({ data: reference.apps, error: null, mapped: true })
      : appSlugs.length
        ? admin
            .from("payment_apps")
            .select("*")
            .in("slug", appSlugs)
            .or(accessibleTaxonomyFilter(userId))
        : Promise.resolve({ data: [], error: null }),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
  const [adjResult, refundResult, instrumentResult, accountResult, categoryResult, appResult] = results;
  const adj = fromSupabaseRows<Adjustment>(adjResult.data);
  const ref = fromSupabaseRows<Refund>(refundResult.data);
  const instrumentRows = "mapped" in instrumentResult
    ? instrumentResult.data as Instrument[]
    : fromSupabaseRows<Instrument>(instrumentResult.data);
  const accountRows = "mapped" in accountResult
    ? accountResult.data as Account[]
    : fromSupabaseRows<Account>(accountResult.data);
  const categoryRows = "mapped" in categoryResult
    ? categoryResult.data as Category[]
    : fromSupabaseRows<Category>(categoryResult.data);
  const appRows = "mapped" in appResult
    ? appResult.data as PaymentApp[]
    : fromSupabaseRows<PaymentApp>(appResult.data);

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
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(f.limit ?? 500);
  if (f.from) query = query.gte("occurred_at", f.from);
  if (f.to) query = query.lte("occurred_at", f.to);
  if (f.instrumentId) query = query.eq("instrument_id", f.instrumentId);
  if (f.accountId) query = query.eq("account_id", f.accountId);
  if (f.categorySlug) query = query.eq("category_slug", f.categorySlug);
  if (f.appSlug) query = query.eq("payment_app_slug", f.appSlug);
  if (f.reimbursableOnly) query = query.eq("reimbursable", true);
  const result = await query;
  if (result.error) throw result.error;
  const rows = fromSupabaseRows<Expense>(result.data);

  const hydrated = await hydrate(rows, userId);
  const searched = f.search
    ? hydrated.filter((row) => {
        const needle = f.search!.toLowerCase();
        return [
          row.expense.description,
          row.expense.merchantName,
          row.expense.customLabel,
          row.expense.notes,
        ].some((value) => value?.toLowerCase().includes(needle));
      })
    : hydrated;
  return f.hasRefund ? searched.filter((r) => r.refunds.length > 0) : searched;
}

export async function getExpense(id: string): Promise<ExpenseRow | null> {
  const userId = await requireUserId();
  const result = await createSupabaseAdminClient()
    .from("expenses")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1);
  if (result.error) throw result.error;
  const [row] = fromSupabaseRows<Expense>(result.data);
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
  const admin = createSupabaseAdminClient();
  const [
    expenseResult,
    selectionResult,
    accountResult,
    categoryResult,
    appResult,
    transferResult,
  ] = await Promise.all([
    admin
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .gte("occurred_at", prev.start)
      .lte("occurred_at", end)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20000),
    admin
      .from("user_card_selections")
      .select("instrument_id")
      .eq("user_id", userId),
    admin
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("sort_order"),
    admin
      .from("categories")
      .select("*")
      .or(accessibleTaxonomyFilter(userId)),
    admin
      .from("payment_apps")
      .select("*")
      .or(accessibleTaxonomyFilter(userId)),
    admin
      .from("transfers")
      .select("*")
      .eq("user_id", userId)
      .gte("occurred_at", start)
      .lte("occurred_at", end),
  ]);
  const loadError = [
    expenseResult,
    selectionResult,
    accountResult,
    categoryResult,
    appResult,
    transferResult,
  ].find((result) => result.error)?.error;
  if (loadError) throw loadError;
  const expenseRows = fromSupabaseRows<Expense>(expenseResult.data);
  const ownedAccounts = fromSupabaseRows<Account>(accountResult.data);
  const accessibleCategories = fromSupabaseRows<Category>(categoryResult.data);
  const accessibleApps = fromSupabaseRows<PaymentApp>(appResult.data);
  const monthTransfers = fromSupabaseRows<Transfer>(transferResult.data);
  const selectedInstrumentIds = new Set(
    (selectionResult.data ?? []).map((row) => String(row.instrument_id)),
  );
  const hydrationInstrumentIds = [
    ...new Set([
      ...selectedInstrumentIds,
      ...expenseRows
        .map((expense) => expense.instrumentId)
        .filter((id): id is string => Boolean(id)),
    ]),
  ];
  const instrumentResult = hydrationInstrumentIds.length
    ? await admin
        .from("instruments")
        .select("*")
        .in("id", hydrationInstrumentIds)
        .or(accessibleInstrumentFilter(userId))
        .order("sort_order")
    : { data: [], error: null };
  if (instrumentResult.error) throw instrumentResult.error;
  const allInstruments = fromSupabaseRows<Instrument>(instrumentResult.data);
  // Unknown legacy references deliberately remain unresolved. The expense
  // mapper renders its existing fallback labels instead of reading another
  // user's pre-ownership account or custom taxonomy row.
  const allAccounts = ownedAccounts;
  const catRows = accessibleCategories;
  const appRows = accessibleApps;
  const visibleInstrumentIds = new Set(selectedInstrumentIds);
  for (const expense of expenseRows) {
    if (
      expense.instrumentId &&
      expense.occurredAt >= start &&
      expense.occurredAt <= end
    ) {
      visibleInstrumentIds.add(expense.instrumentId);
    }
  }
  const visibleInstruments = allInstruments.filter((instrument) =>
    visibleInstrumentIds.has(instrument.id),
  );
  const [hydratedRows, capsByInstrument] = await Promise.all([
    hydrate(expenseRows, userId, {
      instruments: allInstruments,
      accounts: allAccounts,
      categories: catRows,
      apps: appRows,
    }),
    capsForInstruments(visibleInstruments, end, userId),
  ]);
  const rows = hydratedRows.filter(
    (row) =>
      row.expense.occurredAt >= start && row.expense.occurredAt <= end,
  );
  const previousRows = hydratedRows.filter(
    (row) =>
      row.expense.occurredAt >= prev.start &&
      row.expense.occurredAt <= prev.end,
  );
  const totals = sumMath(rows.map((r) => r.math));
  const previousNetPaise = sumMath(
    previousRows.map((r) => r.math),
  ).netSpendPaise;

  /* cards */
  const cards: CardSummary[] = visibleInstruments.map((instrument) => {
    const mine = rows.filter((r) => r.expense.instrumentId === instrument.id);
    return {
      instrument,
      grossPaise: mine.reduce((s, r) => s + r.math.grossPaise, 0),
      netSpendPaise: mine.reduce((s, r) => s + r.math.netSpendPaise, 0),
      rewardValuePaise: mine.reduce((s, r) => s + r.math.rewardValuePaise, 0),
      rewardUnitsMilli: mine.reduce((s, r) => s + r.expense.rewardUnitsMilli, 0),
      rewardLostPaise: mine.reduce((s, r) => s + r.math.rewardLostToCapPaise, 0),
      txnCount: mine.length,
      caps: capsByInstrument.get(instrument.id) ?? [],
    };
  });

  /* accounts */
  const accountsSpend = allAccounts.map((account) => {
    const mine = rows.filter((r) => r.expense.accountId === account.id);
    return {
      account,
      netPaise: mine.reduce((s, r) => s + r.math.netSpendPaise, 0),
      txnCount: mine.length,
    };
  });

  /* categories — rolled up to their top-level parent */
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

export async function getPeopleBalances(
  authenticatedUserId?: string,
): Promise<PersonBalance[]> {
  const userId = authenticatedUserId ?? await requireUserId();
  const admin = createSupabaseAdminClient();
  const [peopleResult, transferResult] = await Promise.all([
    admin
      .from("people")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("name"),
    admin.from("transfers").select("*").eq("user_id", userId),
  ]);
  if (peopleResult.error) throw peopleResult.error;
  if (transferResult.error) throw transferResult.error;
  const allPeople = fromSupabaseRows<Person>(peopleResult.data);
  const allTransfers = fromSupabaseRows<Transfer>(transferResult.data);

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

export async function listTransfers(
  limit = 200,
  authenticatedUserId?: string,
): Promise<(Transfer & {
  personName: string;
  personColor: string;
})[]> {
  const userId = authenticatedUserId ?? await requireUserId();
  const admin = createSupabaseAdminClient();
  const [peopleResult, transferResult] = await Promise.all([
    admin.from("people").select("*").eq("user_id", userId),
    admin
      .from("transfers")
      .select("*")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);
  if (peopleResult.error) throw peopleResult.error;
  if (transferResult.error) throw transferResult.error;
  const peopleRows = fromSupabaseRows<Person>(peopleResult.data);
  const rows = fromSupabaseRows<Transfer>(transferResult.data);
  const peopleMap = new Map(peopleRows.map((p) => [p.id, p]));
  return rows.map((t) => ({
      ...t,
      personName: (t.personId && peopleMap.get(t.personId)?.name) || "Someone",
      personColor: (t.personId && peopleMap.get(t.personId)?.colorHex) || "#868E96",
    }));
}

/* --------------------------------------------------------------- pending */

export interface PendingSummary {
  reimbursements: ExpenseRow[];
  standaloneReimbursements: StandaloneReimbursementRow[];
  refunds: ExpenseRow[];
  reimbursementOutstandingPaise: number;
  standaloneReimbursementOutstandingPaise: number;
  refundPendingPaise: number;
  lendingOutstandingPaise: number;
}

export interface StandaloneReimbursementRow {
  reimbursement: StandaloneReimbursement;
  receipts: StandaloneReimbursementReceipt[];
  receivedPaise: number;
  outstandingPaise: number;
  status: StandaloneReimbursementStatus;
}

function hydrateStandaloneReimbursements(
  claims: StandaloneReimbursement[],
  receipts: StandaloneReimbursementReceipt[],
): StandaloneReimbursementRow[] {
  const receiptsByClaim = new Map<string, StandaloneReimbursementReceipt[]>();
  for (const receipt of receipts) {
    const rows = receiptsByClaim.get(receipt.reimbursementId) ?? [];
    rows.push(receipt);
    receiptsByClaim.set(receipt.reimbursementId, rows);
  }

  return claims.map((reimbursement) => {
    const claimReceipts = receiptsByClaim.get(reimbursement.id) ?? [];
    return {
      reimbursement,
      receipts: claimReceipts,
      ...deriveStandaloneReimbursementState(reimbursement, claimReceipts),
    };
  });
}

export async function listStandaloneReimbursements(
  authenticatedUserId?: string,
): Promise<StandaloneReimbursementRow[]> {
  const userId = authenticatedUserId ?? await requireUserId();
  const admin = createSupabaseAdminClient();
  const [claimResult, receiptResult] = await Promise.all([
    admin
      .from("standalone_reimbursements")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("claimed_at", { ascending: false })
      .order("created_at", { ascending: false }),
    admin
      .from("standalone_reimbursement_receipts")
      .select("*")
      .eq("user_id", userId)
      .order("received_at", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  if (claimResult.error) throw claimResult.error;
  if (receiptResult.error) throw receiptResult.error;

  return hydrateStandaloneReimbursements(
    fromSupabaseRows<StandaloneReimbursement>(claimResult.data),
    fromSupabaseRows<StandaloneReimbursementReceipt>(receiptResult.data),
  );
}

export async function getStandaloneReimbursement(
  rowId: string,
): Promise<StandaloneReimbursementRow | null> {
  const userId = await requireUserId();
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
      .eq("user_id", userId)
      .order("received_at", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  if (claimResult.error) throw claimResult.error;
  if (receiptResult.error) throw receiptResult.error;
  const [claim] = fromSupabaseRows<StandaloneReimbursement>(claimResult.data);
  if (!claim) return null;

  return hydrateStandaloneReimbursements(
    [claim],
    fromSupabaseRows<StandaloneReimbursementReceipt>(receiptResult.data),
  )[0] ?? null;
}

export async function getPending(): Promise<PendingSummary> {
  const userId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const [expenseResult, refundResult, balances, allStandaloneReimbursements] =
    await Promise.all([
    admin
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .eq("reimbursable", true)
      .in("reimbursement_status", ["pending", "partial"])
      .order("reimbursement_due_date")
      .order("occurred_at", { ascending: false }),
    admin
      .from("refunds")
      .select("expense_id")
      .eq("user_id", userId)
      .eq("status", "pending"),
    getPeopleBalances(userId),
    listStandaloneReimbursements(userId),
  ]);
  if (expenseResult.error) throw expenseResult.error;
  if (refundResult.error) throw refundResult.error;
  const reimbursementExpenses = fromSupabaseRows<Expense>(expenseResult.data);
  const pendingRefundRows = fromSupabaseRows<{ expenseId: string }>(refundResult.data);
  const reimbursementRows = await hydrate(reimbursementExpenses, userId);
  const pendingRefundIds = pendingRefundRows.map((r) => r.expenseId);
  let refundRows: ExpenseRow[] = [];
  if (pendingRefundIds.length) {
    const pendingExpenseResult = await admin
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .in("id", pendingRefundIds);
    if (pendingExpenseResult.error) throw pendingExpenseResult.error;
    refundRows = await hydrate(
      fromSupabaseRows<Expense>(pendingExpenseResult.data),
      userId,
    );
  }

  return {
    reimbursements: reimbursementRows,
    standaloneReimbursements: allStandaloneReimbursements,
    refunds: refundRows,
    reimbursementOutstandingPaise: reimbursementRows.reduce(
      (s, r) => s + r.math.reimbursementOutstandingPaise,
      0,
    ),
    standaloneReimbursementOutstandingPaise: allStandaloneReimbursements.reduce(
      (sum, row) => sum + row.outstandingPaise,
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
  const userId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const [selectionResult, historyResult, instrumentResult] = await Promise.all([
    admin
      .from("user_card_selections")
      .select("instrument_id")
      .eq("user_id", userId)
      .eq("instrument_id", id)
      .maybeSingle(),
    admin
      .from("expenses")
      .select("id")
      .eq("user_id", userId)
      .eq("instrument_id", id)
      .limit(1),
    admin
      .from("instruments")
      .select("*")
      .eq("id", id)
      .or(accessibleInstrumentFilter(userId))
      .limit(1),
  ]);
  if (selectionResult.error) throw selectionResult.error;
  if (historyResult.error) throw historyResult.error;
  if (!selectionResult.data && !historyResult.data?.length) return null;
  if (instrumentResult.error) throw instrumentResult.error;
  const [instrument] = fromSupabaseRows<Instrument>(instrumentResult.data);
  if (!instrument) return null;
  let rules: RewardRule[] = [];
  if (rewardAutomationEnabled(instrument)) {
    const ruleResult = await admin
      .from("reward_rules")
      .select("*")
      .eq("instrument_id", id)
      .order("priority", { ascending: false })
      .order("name");
    if (ruleResult.error) throw ruleResult.error;
    rules = fromSupabaseRows<RewardRule>(ruleResult.data);
  }
  return { instrument, rules };
}

export async function getYearRewardTrend(instrumentId: string, year: number) {
  const yearStart = monthBounds(year, 1).start;
  const yearEnd = monthBounds(year, 12).end;
  const rows = await listExpenses({
    from: yearStart,
    to: yearEnd,
    instrumentId,
    limit: 10000,
  });
  const out: { month: number; rewardPaise: number; netPaise: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const { start, end } = monthBounds(year, m);
    const monthRows = rows.filter(
      (row) => row.expense.occurredAt >= start && row.expense.occurredAt <= end,
    );
    out.push({
      month: m,
      rewardPaise: monthRows.reduce((s, r) => s + r.math.rewardValuePaise, 0),
      netPaise: monthRows.reduce((s, r) => s + r.math.netSpendPaise, 0),
    });
  }
  return out;
}
