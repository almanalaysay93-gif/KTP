import type { Request } from "express";
import type { Doctor } from "../drizzle/schema";
import type { AdminBroadcastMessage } from "./dbMessages";
import { restoreDates, rustRequest } from "./rustBackend";

export async function rustDoctors(
  req: Request,
  input?: { role?: string; activeOnly?: boolean }
): Promise<Doctor[]> {
  return (await rustRequest<Doctor[]>(req, "/api/rust/doctors", input)).map(
    row => restoreDates(row)
  );
}
export async function rustDoctor(req: Request, id: number): Promise<Doctor> {
  return restoreDates(
    await rustRequest<Doctor>(req, "/api/rust/admin/entities/doctor", { id })
  );
}
export async function rustDoctorWrite(
  req: Request,
  action: "createDoctor" | "updateDoctor",
  input: object
): Promise<Doctor> {
  return restoreDates(
    await rustRequest<Doctor>(
      req,
      `/api/rust/admin/entities/${action}`,
      {},
      input
    )
  );
}
export interface RustAdminSettings {
  appTitle: string;
  orgName: string;
  contactEmail: string;
  emergencyHotlineText: string;
  consentNoticeText: string;
  consentVersion: string;
}
export function rustAdminSettings(req: Request) {
  return rustRequest<RustAdminSettings>(
    req,
    "/api/rust/admin/entities/settings"
  );
}
export function rustSettingsWrite(req: Request, input: object) {
  return rustRequest<{ success: true }>(
    req,
    "/api/rust/admin/entities/updateSettings",
    {},
    input
  );
}
export function rustAdminMessages(req: Request) {
  return rustRequest<AdminBroadcastMessage[]>(req, "/api/rust/admin/messages");
}
export function rustBroadcast(req: Request, input: object) {
  return rustRequest<{ id: number; recipientCount: number }>(
    req,
    "/api/rust/admin/messages",
    {},
    input
  );
}
