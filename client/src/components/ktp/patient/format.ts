/*
 * Patient-surface formatting (VOICE.md section 5) and the patient wording of every status
 * (COPY.md section 5). Dates are Asia/Manila calendar dates, so all math is date-only in UTC.
 */
import type { ChipStatus } from "@/components/clay";

export type DueState = "Overdue" | "DueSoon" | "Upcoming";
export type ClaimState = "Filed" | "Overdue" | "DueSoon" | "Open" | "None";
export type AppointmentResponse = "Pending" | "Confirmed" | "RescheduleRequested";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MS_PER_DAY = 86_400_000;

function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d, day: Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY) };
}

/** Whole days from `today` to `iso` (negative when past). */
export function daysFrom(iso: string, today: string): number {
  return parts(iso).day - parts(today).day;
}

/** "Thu, 1 Oct", or "Thu, 1 Oct 2027" when the year is not the current one. */
export function patientDate(iso: string, today: string): string {
  const { y, m, d } = parts(iso);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const base = `${weekday}, ${d} ${MONTHS[m - 1]}`;
  return y === parts(today).y ? base : `${base} ${y}`;
}

/** "Today", "Tomorrow", "In 5 days", "Yesterday", "8 days ago". */
export function relativeDay(iso: string, today: string): string {
  const n = daysFrom(iso, today);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return n > 0 ? `In ${n} days` : `${-n} days ago`;
}

/** "7:00 AM", read from the written Manila time of an ISO date-time. */
export function patientTime(isoDateTime: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(isoDateTime);
  if (!match) return "";
  const hour = Number(match[1]);
  const suffix = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${match[2]} ${suffix}`;
}

export interface PatientChip {
  status: ChipStatus;
  label: string;
  /** Screen-reader prefix, for example "Claim status:". */
  context: string;
}

/**
 * Past due and past deadline use the calm grey chip with a History icon: never the raspberry
 * alarm on patient surfaces (COPY.md 3, VOICE.md 4.5). Word and icon always ride along.
 */
export const DUE_CHIP: Record<DueState, PatientChip> = {
  Overdue: { status: "superseded", label: "Past due", context: "Status:" },
  DueSoon: { status: "due-soon", label: "Due soon", context: "Status:" },
  Upcoming: { status: "upcoming", label: "Coming up", context: "Status:" },
};

export const CLAIM_CHIP: Record<Exclude<ClaimState, "None">, PatientChip> = {
  Overdue: { status: "superseded", label: "Past deadline", context: "Claim status:" },
  DueSoon: { status: "due-soon", label: "Claim due soon", context: "Claim status:" },
  Open: { status: "open", label: "Claim open", context: "Claim status:" },
  Filed: { status: "filed", label: "Claim filed", context: "Claim status:" },
};

export const APPOINTMENT_CHIP: Record<AppointmentResponse, PatientChip> = {
  Pending: { status: "info", label: "Please reply", context: "Reply status:" },
  Confirmed: { status: "done", label: "Confirmed", context: "Reply status:" },
  RescheduleRequested: { status: "planned", label: "New time requested", context: "Reply status:" },
};

/** COPY.md 5.5 patient explanations. */
export const APPOINTMENT_HINT: Record<AppointmentResponse, string> = {
  Pending: "Please tap Confirm or Request new time.",
  Confirmed: "You confirmed this appointment.",
  RescheduleRequested: "You asked for a new time. You will get a notice when the KT unit sets it.",
};

/** "1 day" / "2 days". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
