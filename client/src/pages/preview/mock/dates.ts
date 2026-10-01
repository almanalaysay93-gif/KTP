import { dateKey } from "@shared/ktp";
// Pure ISO date helpers. Date-only math in UTC so results never shift with the
// machine time zone. Full ISO strings are read by their written (Manila) date.

const MS_PER_DAY = 86_400_000;

function toDayNumber(value: string | Date | null | undefined): number {
  const key = dateKey(value);
  return key ? Math.round(Date.parse(key) / MS_PER_DAY) : NaN;
}

export function datePart(value: string | Date | null | undefined): string {
  return dateKey(value);
}

export function addDays(iso: string | Date, days: number): string {
  const day = toDayNumber(iso);
  return Number.isFinite(day)
    ? new Date((day + days) * MS_PER_DAY).toISOString().slice(0, 10)
    : "";
}

/** Whole days from b to a (a minus b). */
export function diffDays(a: string | Date, b: string | Date): number {
  return toDayNumber(a) - toDayNumber(b);
}
