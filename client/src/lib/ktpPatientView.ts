import {
  RECIPIENT_STAGES,
  DONOR_STAGES,
  type RecipientStage,
  type DonorStage,
} from "@shared/ktp";
import type {
  Patient as ApiPatient,
  Doctor as ApiDoctor,
} from "../../../drizzle/schema";
import type { Patient, Doctor } from "./ktpViewTypes";
import { dateKey } from "@shared/ktp";

export function parsePatientId(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function patientAge(
  birthDate: string | Date | null,
  today: string
): number | null {
  const birth = dateKey(birthDate);
  const current = dateKey(today);
  if (!birth || !current || birth > current) return null;
  const years = Number(current.slice(0, 4)) - Number(birth.slice(0, 4));
  return years - (current.slice(5) < birth.slice(5) ? 1 : 0);
}

export function toPatientView(patient: ApiPatient, today: string): Patient {
  const common = {
    ...patient,
    middleName: patient.middleName ?? "",
    birthDate: dateKey(patient.birthDate) || null,
    surgeryDate: dateKey(patient.surgeryDate) || null,
    age: patientAge(patient.birthDate, today),
  };
  // Database stages are validated on writes. Reject unexpected payloads at this boundary.
  if (patient.patientType === "Recipient") {
    if (!RECIPIENT_STAGES.includes(patient.stage as RecipientStage))
      throw new Error("Invalid recipient stage");
    return {
      ...common,
      patientType: "Recipient",
      stage: patient.stage as RecipientStage,
      linkedRecipientId: null,
    };
  }
  if (!DONOR_STAGES.includes(patient.stage as DonorStage))
    throw new Error("Invalid donor stage");
  return {
    ...common,
    patientType: "Donor",
    stage: patient.stage as DonorStage,
  };
}

export function toDoctorView(doctor: ApiDoctor): Doctor {
  return { ...doctor };
}

export function patientDisplayName(
  patient: Pick<Patient, "lastName" | "firstName" | "middleName">
): string {
  const initial = patient.middleName ? ` ${patient.middleName.charAt(0)}.` : "";
  return `${patient.lastName}, ${patient.firstName}${initial}`;
}

export function daysSinceSurgery(
  patient: Pick<Patient, "surgeryDate">,
  today: string
): number | null {
  const surgery = dateKey(patient.surgeryDate);
  const current = dateKey(today);
  if (!surgery || !current) return null;
  return Math.round((Date.parse(current) - Date.parse(surgery)) / 86_400_000);
}
