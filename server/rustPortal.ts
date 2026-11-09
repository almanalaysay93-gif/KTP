import type { Request } from "express";
import type { Doctor, Patient, User } from "../drizzle/schema";
import type { getClinical } from "./dbClinical";
import type { PatientMessageItem } from "./dbMessages";
import { patientDates, restoreDates, rustRequest } from "./rustBackend";

type Me = User & {
  isAdmin: boolean;
  patient: Patient | null;
  consentRequired: boolean;
};
export async function rustAuthMe(req: Request): Promise<Me | null> {
  const result = await rustRequest<Me | null>(req, "/api/rust/auth/me");
  return result
    ? {
        ...restoreDates(result, ["createdAt", "updatedAt", "lastSignedIn"]),
        patient: result.patient ? patientDates(result.patient) : null,
      }
    : null;
}

export function rustConsentNotice(req: Request) {
  return rustRequest<{ consentNoticeText: string; consentVersion: number }>(
    req,
    "/api/rust/auth/consent-notice"
  );
}

export async function rustPatientAccess(req: Request) {
  const result = await rustRequest<{
    patient: Patient;
    consentRequired: boolean;
  }>(req, "/api/rust/patient/access");
  return { ...result, patient: patientDates(result.patient) };
}

export async function rustAcceptConsent(req: Request) {
  const result = await rustRequest<{
    success: boolean;
    consentVersion: number;
    patient: Patient | null;
  }>(req, "/api/rust/patient/consent", {}, {});
  return {
    ...result,
    patient: result.patient ? patientDates(result.patient) : null,
  };
}

export async function rustPortalProfile(req: Request) {
  const result = await rustRequest<{
    patient: Patient;
    nephrologist: Doctor | null;
    fellow: Doctor | null;
    linkedRecipientName: string | null;
  }>(req, "/api/rust/patient/profile");
  return {
    ...result,
    patient: patientDates(result.patient),
    nephrologist: result.nephrologist
      ? restoreDates(result.nephrologist)
      : null,
    fellow: result.fellow ? restoreDates(result.fellow) : null,
  };
}

export async function rustClinical(
  req: Request,
  patientId?: number
): Promise<Awaited<ReturnType<typeof getClinical>>> {
  const result = await rustRequest<Awaited<ReturnType<typeof getClinical>>>(
    req,
    patientId === undefined
      ? "/api/rust/patient/clinical"
      : `/api/rust/clinical/patients/${patientId}`
  );
  return {
    ...result,
    services: result.services.map(row => restoreDates(row)),
    labResults: result.labResults.map(row => restoreDates(row, ["createdAt"])),
    checklist: result.checklist.map(row => restoreDates(row)),
    appointments: result.appointments.map(row =>
      restoreDates(row, ["createdAt", "updatedAt", "respondedAt"])
    ),
  };
}

export function rustPortalMessages(req: Request) {
  return rustRequest<PatientMessageItem[]>(req, "/api/rust/patient/messages");
}

export function rustPortalSettings(req: Request) {
  return rustRequest<{ emergencyHotlineText: string }>(
    req,
    "/api/rust/patient/settings"
  );
}

export function rustRespondAppointment(
  req: Request,
  input: {
    appointmentId: number;
    response: "Confirmed" | "RescheduleRequested";
    responseNote?: string;
  }
) {
  return rustRequest<{
    id: number;
    response: "Confirmed" | "RescheduleRequested";
  }>(
    req,
    `/api/rust/patient/appointments/${input.appointmentId}/response`,
    {},
    {
      response: input.response,
      ...(input.responseNote === undefined
        ? {}
        : { responseNote: input.responseNote }),
    }
  );
}

export function rustAcknowledgeMessage(req: Request, messageId: number) {
  return rustRequest<{ success: boolean }>(
    req,
    `/api/rust/patient/messages/${messageId}/acknowledge`,
    {},
    {}
  );
}

export function rustSubmitPatientLab(
  req: Request,
  input: {
    serviceDate: string;
    note?: string;
    items: { labTestId: number; value: string }[];
  }
) {
  return rustRequest<{ success: boolean; recordId: number }>(
    req,
    "/api/rust/patient/labs",
    {},
    input
  );
}

export async function rustUpdateContact(
  req: Request,
  contactNumber: string | null
) {
  const result = await rustRequest<Patient>(
    req,
    "/api/rust/patient/contact",
    {},
    { contactNumber }
  );
  return patientDates(result);
}
