// Pure ISO date helpers. Date-only math in UTC so results never shift with the
// machine time zone. Full ISO strings are read by their written (Manila) date.

const MS_PER_DAY = 86_400_000;

function toIsoString(val: string | Date | null | undefined): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function toDayNumber(iso: string | Date | null | undefined): number {
  const str = toIsoString(iso);
  if (!str) return 0;
  const [y, m, d] = str.slice(0, 10).split("-").map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return 0;
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** Date part (YYYY-MM-DD) of a date or date-time string. */
export function datePart(iso: string | Date | null | undefined): string {
  const str = toIsoString(iso);
  return str ? str.slice(0, 10) : "";
}

export function addDays(iso: string | Date, days: number): string {
  return new Date((toDayNumber(iso) + days) * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole days from b to a (a minus b). */
export function diffDays(a: string | Date, b: string | Date): number {
  return toDayNumber(a) - toDayNumber(b);
}
