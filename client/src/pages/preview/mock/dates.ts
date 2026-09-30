// Pure ISO date helpers. Date-only math in UTC so results never shift with the
// machine time zone. Full ISO strings are read by their written (Manila) date.

const MS_PER_DAY = 86_400_000;

function toDayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** Date part (YYYY-MM-DD) of a date or date-time string. */
export function datePart(iso: string): string {
  return iso.slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return new Date((toDayNumber(iso) + days) * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole days from b to a (a minus b). */
export function diffDays(a: string, b: string): number {
  return toDayNumber(a) - toDayNumber(b);
}
