import type { Request } from "express";
import type { ActivityLog, Patient } from "../drizzle/schema";
import { patientDates, restoreDates, rustRequest } from "./rustBackend";

export async function rustPatientWrite(
  req: Request,
  action: "create" | "update" | "archive",
  input: object
): Promise<Patient> {
  return patientDates(
    await rustRequest<Patient>(
      req,
      `/api/rust/admin/patients/${action}`,
      {},
      input
    )
  );
}
export async function rustPatientActivity(
  req: Request,
  input: { patientId: number; limit?: number }
): Promise<ActivityLog[]> {
  return (
    await rustRequest<ActivityLog[]>(
      req,
      "/api/rust/admin/patient-activity",
      input
    )
  ).map(row => restoreDates(row, ["createdAt"]));
}
