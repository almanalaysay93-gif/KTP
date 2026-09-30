/*
 * View models for the patient home. Components take these plain shapes, so the preview feeds them
 * from fictional mock data today and the real /me page feeds them from tRPC later.
 * Dates are ISO (YYYY-MM-DD); date-times are ISO with the Manila offset.
 */
import type { AppointmentResponse, ClaimState, DueState } from "./format";

export type SectionState = "ready" | "loading" | "error";

export interface DueItemView {
  id: string;
  /** Patient label, for example "Laboratory, Monthly panel" or "Tacro test". */
  name: string;
  /** One-line plain explanation (COPY.md 5.2), shown the first time a term appears. */
  explain?: string;
  dueDate: string;
  state: DueState;
}

export interface ClaimItemView {
  id: string;
  name: string;
  serviceDate: string;
  deadline: string;
  status: Exclude<ClaimState, "None">;
  /** A repeat replaced this record; its own claim is still tracked. */
  repeated?: boolean;
}

export interface AppointmentView {
  id: string;
  title: string;
  startsAt: string;
  location: string;
  response: AppointmentResponse;
  /** The patient's own reschedule note, once sent. */
  responseNote?: string | null;
}

export interface MessageView {
  id: string;
  title: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
}

/** Async action result for Confirm, Send request, and I have read this. */
export type ActionResult = { ok: true } | { ok: false };
