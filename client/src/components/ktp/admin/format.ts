/*
 * Admin formatting helpers (VOICE.md section 5). Date-only math in UTC so a date never
 * shifts with the machine time zone. Date-times are read by their written (Manila) clock.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, weekday };
}

/** Table date: "01 Oct 2026". */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

/** Cell date: "01 Oct". */
export function fmtDayMonth(iso: string): string {
  const { m, d } = parts(iso);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]}`;
}

/** Chart tick: "6 May". */
export function fmtTick(iso: string): string {
  const { m, d } = parts(iso);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Short with weekday: "Thu 1 Oct". */
export function fmtWeekday(iso: string): string {
  const { m, d, weekday } = parts(iso);
  return `${DAYS[weekday]} ${d} ${MONTHS[m - 1]}`;
}

/** Header date line: "Wednesday, 30 September 2026". */
export function fmtLongDate(iso: string): string {
  const { y, m, d, weekday } = parts(iso);
  return `${DAYS_LONG[weekday]}, ${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

/** "7:00 AM" from "2026-10-01T07:00:00+08:00". */
export function fmtTime(isoDateTime: string): string {
  const [hh, mm] = isoDateTime.slice(11, 16).split(":").map(Number);
  const suffix = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

/** Calendar-month add with day clamping: 31 Jan + 1 = 28 Feb. */
export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parts(iso);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** "1 day" or "2 days". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** COPY dash.cell: overdue cells read "{n} d"; time-left cells read "{n} d left" or "Today". */
export function overdueBy(days: number): string {
  return `${days} d`;
}
export function timeLeft(days: number): string {
  return days <= 0 ? "Today" : `${days} d left`;
}
