/** Everything monetary in LedgerKit is an integer number of paise. */

export const PAISE = 100;

export function toPaise(rupees: number | string): number {
  const n = typeof rupees === "string" ? Number(rupees.replace(/[^0-9.-]/g, "")) : rupees;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * PAISE);
}

export function toRupees(paise: number): number {
  return paise / PAISE;
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const inrCompactWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** "₹1,23,456.78" */
export function formatMoney(paise: number): string {
  return inr.format(paise / PAISE);
}

/** "₹1,23,457" — for headline figures where decimals are noise. */
export function formatMoneyWhole(paise: number): string {
  return inrCompactWhole.format(Math.round(paise / PAISE));
}

/** "₹1.2L", "₹45.3k" — for axis ticks and dense chips. */
export function formatMoneyShort(paise: number): string {
  const r = Math.abs(paise) / PAISE;
  const sign = paise < 0 ? "-" : "";
  if (r >= 1e7) return `${sign}₹${(r / 1e7).toFixed(r >= 1e8 ? 0 : 1)}Cr`;
  if (r >= 1e5) return `${sign}₹${(r / 1e5).toFixed(r >= 1e6 ? 0 : 1)}L`;
  if (r >= 1e3) return `${sign}₹${(r / 1e3).toFixed(r >= 1e4 ? 0 : 1)}k`;
  return `${sign}₹${Math.round(r)}`;
}

/** Reward quantities are milli-units so fractional points survive storage. */
export const MILLI = 1000;

export function formatUnits(unitsMilli: number, unit: string): string {
  const units = unitsMilli / MILLI;
  if (unit === "INR") return formatMoney(Math.round(units * PAISE));
  const rounded = Math.abs(units % 1) < 0.005 ? Math.round(units) : Number(units.toFixed(2));
  return `${new Intl.NumberFormat("en-IN").format(rounded)} ${unit}`;
}

export function percentFromBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0$/, "")}%`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
