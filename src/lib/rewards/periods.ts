export type CapPeriod = "month" | "quarter" | "year" | "statement" | "none";

function parse(dateISO: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateISO.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A stable bucket key for cap accounting. Two expenses share a cap bucket only
 * when their keys match.
 */
export function periodKey(
  period: CapPeriod,
  dateISO: string,
  statementDay = 1,
): string {
  const { y, m, d } = parse(dateISO);
  switch (period) {
    case "month":
      return `${y}-${pad(m)}`;
    case "quarter":
      return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    case "year":
      return `${y}`;
    case "statement": {
      // Cycle runs from statementDay of one month to the day before the next.
      const day = Math.min(Math.max(statementDay, 1), 28);
      if (d >= day) return `${y}-${pad(m)}-${pad(day)}`;
      const pm = m === 1 ? 12 : m - 1;
      const py = m === 1 ? y - 1 : y;
      return `${py}-${pad(pm)}-${pad(day)}`;
    }
    default:
      return "*";
  }
}

export function periodLabel(period: CapPeriod): string {
  return (
    { month: "this month", quarter: "this quarter", year: "this year", statement: "this statement cycle", none: "" } as const
  )[period];
}

/** Inclusive [start, end] ISO dates for a calendar month. */
export function monthBounds(year: number, month: number) {
  const start = `${year}-${pad(month)}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start, end: `${year}-${pad(month)}-${pad(last)}` };
}

export function yearBounds(year: number) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function addMonths(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthName(month: number, long = false): string {
  const names = long
    ? ["January","February","March","April","May","June","July","August","September","October","November","December"]
    : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return names[month - 1] ?? "";
}

export function formatDate(dateISO: string): string {
  const { y, m, d } = parse(dateISO);
  return `${d} ${monthName(m)} ${y}`;
}

export function formatDateShort(dateISO: string): string {
  const { m, d } = parse(dateISO);
  return `${d} ${monthName(m)}`;
}
