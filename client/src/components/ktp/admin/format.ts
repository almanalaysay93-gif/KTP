import { dateKey, todayDate } from "@shared/ktp";
/*
 * Admin formatting helpers (VOICE.md section 5). Date-only math in UTC so a date never
 * shifts with the machine time zone. Date-times are read by their written (Manila) clock.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function parts(value: string | Date | null | undefined) {
  const key = dateKey(value);
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d, weekday: new Date(`${key}T00:00:00Z`).getUTCDay() };
}

export function fmtDate(value: string | Date | null | undefined): string {
  const p = parts(value);
  return p
    ? `${String(p.d).padStart(2, "0")} ${MONTHS[p.m - 1]} ${p.y}`
    : "Not set";
}
/** Date for a table cell: the only line break is before the year, so a narrow column shows "02 Oct" above "2026". */
export function fmtDateCell(value: string | Date | null | undefined): string {
  return fmtDate(value).replace(/^(\d+) /, "$1 ");
}
export function fmtDayMonth(value: string | Date): string {
  const p = parts(value);
  return p ? `${String(p.d).padStart(2, "0")} ${MONTHS[p.m - 1]}` : "Not set";
}
export function fmtTick(value: string | Date): string {
  const p = parts(value);
  return p ? `${p.d} ${MONTHS[p.m - 1]}` : "Not set";
}
export function fmtWeekday(value: string | Date): string {
  const timestamp = value instanceof Date || value.includes("T");
  const p = parts(timestamp ? (dateKey(value) ? todayDate(new Date(value)) : "") : value);
  return p ? `${DAYS[p.weekday]} ${p.d} ${MONTHS[p.m - 1]}` : "Not set";
}
export function fmtLongDate(value: string | Date): string {
  const p = parts(value);
  return p
    ? `${DAYS_LONG[p.weekday]}, ${p.d} ${MONTHS_LONG[p.m - 1]} ${p.y}`
    : "Not set";
}
export function fmtTime(value: string | Date): string {
  if (!dateKey(value)) return "Not set";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
export function addMonths(value: string | Date, months: number): string {
  const p = parts(value);
  if (!p) return "";
  const target = new Date(Date.UTC(p.y, p.m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(p.d, lastDay));
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
