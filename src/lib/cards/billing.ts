export interface BillingConfig {
  statementDay: number | null;
  dueOffsetDays: number;
  openingOutstandingPaise: number;
  openingDate: string | null;
}

export interface CardActivity {
  occurredAt: string;
  amountPaise: number;
}

export interface CardPaymentActivity {
  paidAt: string;
  amountPaise: number;
}

export interface CardCycleSummary {
  configured: boolean;
  cycleStart: string | null;
  statementDate: string | null;
  dueDate: string | null;
  nextStatementDate: string | null;
  currentOutstandingPaise: number;
  statementBalancePaise: number;
  amountDuePaise: number;
  unbilledPaise: number;
  paidAfterStatementPaise: number;
  paidThisMonthPaise: number;
  daysUntilDue: number | null;
  status: "not_configured" | "paid" | "due" | "overdue";
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function dateFromISO(value: string) {
  if (!ISO_DATE.test(value)) throw new Error(`Invalid ISO date: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Clamp days such as 31 to the final real day of a shorter month. */
export function dateForDay(year: number, monthIndex: number, day: number) {
  return new Date(
    Date.UTC(year, monthIndex, Math.min(day, daysInMonth(year, monthIndex))),
  );
}

export function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

export function statementWindow(todayISO: string, statementDay: number) {
  const today = dateFromISO(todayISO);
  const thisMonthStatement = dateForDay(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    statementDay,
  );
  const statementDate =
    today >= thisMonthStatement
      ? thisMonthStatement
      : dateForDay(
          today.getUTCFullYear(),
          today.getUTCMonth() - 1,
          statementDay,
        );
  const previousStatement = dateForDay(
    statementDate.getUTCFullYear(),
    statementDate.getUTCMonth() - 1,
    statementDay,
  );
  const nextStatement = dateForDay(
    statementDate.getUTCFullYear(),
    statementDate.getUTCMonth() + 1,
    statementDay,
  );
  return {
    cycleStart: iso(addDays(previousStatement, 1)),
    statementDate: iso(statementDate),
    nextStatementDate: iso(nextStatement),
  };
}

function sumThrough<T extends { amountPaise: number }>(
  rows: T[],
  date: (row: T) => string,
  end: string,
  start?: string | null,
) {
  return rows
    .filter((row) => date(row) <= end && (!start || date(row) >= start))
    .reduce((sum, row) => sum + row.amountPaise, 0);
}

export function computeCardCycle(input: {
  today: string;
  config: BillingConfig;
  charges: CardActivity[];
  credits: CardActivity[];
  payments: CardPaymentActivity[];
}): CardCycleSummary {
  const { today, config, charges, credits, payments } = input;
  const openingDate = config.openingDate;
  const monthStart = `${today.slice(0, 7)}-01`;
  const totalCharges = sumThrough(charges, (row) => row.occurredAt, today, openingDate);
  const totalCredits = sumThrough(credits, (row) => row.occurredAt, today, openingDate);
  const totalPayments = sumThrough(payments, (row) => row.paidAt, today, openingDate);
  const currentOutstandingPaise =
    config.openingOutstandingPaise + totalCharges - totalCredits - totalPayments;

  if (!config.statementDay) {
    return {
      configured: false,
      cycleStart: null,
      statementDate: null,
      dueDate: null,
      nextStatementDate: null,
      currentOutstandingPaise,
      statementBalancePaise: 0,
      amountDuePaise: 0,
      unbilledPaise: currentOutstandingPaise,
      paidAfterStatementPaise: 0,
      paidThisMonthPaise: sumThrough(payments, (row) => row.paidAt, today, monthStart),
      daysUntilDue: null,
      status: "not_configured",
    };
  }

  const window = statementWindow(today, config.statementDay);
  const chargesAtStatement = sumThrough(charges, (row) => row.occurredAt, window.statementDate, openingDate);
  const creditsAtStatement = sumThrough(credits, (row) => row.occurredAt, window.statementDate, openingDate);
  const paymentsAtStatement = sumThrough(payments, (row) => row.paidAt, window.statementDate, openingDate);
  const statementBalancePaise = Math.max(
    0,
    config.openingOutstandingPaise + chargesAtStatement - creditsAtStatement - paymentsAtStatement,
  );
  const paidAfterStatementPaise = payments
    .filter((row) => row.paidAt > window.statementDate && row.paidAt <= today)
    .reduce((sum, row) => sum + row.amountPaise, 0);
  const amountDuePaise = Math.max(0, statementBalancePaise - paidAfterStatementPaise);
  const dueDate = iso(addDays(dateFromISO(window.statementDate), config.dueOffsetDays));
  const unbilledPaise =
    charges
      .filter((row) => row.occurredAt > window.statementDate && row.occurredAt <= today)
      .reduce((sum, row) => sum + row.amountPaise, 0) -
    credits
      .filter((row) => row.occurredAt > window.statementDate && row.occurredAt <= today)
      .reduce((sum, row) => sum + row.amountPaise, 0);
  const daysUntilDue = Math.round(
    (dateFromISO(dueDate).getTime() - dateFromISO(today).getTime()) / 86_400_000,
  );

  return {
    configured: true,
    ...window,
    dueDate,
    currentOutstandingPaise,
    statementBalancePaise,
    amountDuePaise,
    unbilledPaise,
    paidAfterStatementPaise,
    paidThisMonthPaise: sumThrough(payments, (row) => row.paidAt, today, monthStart),
    daysUntilDue,
    status: amountDuePaise <= 0 ? "paid" : daysUntilDue < 0 ? "overdue" : "due",
  };
}
