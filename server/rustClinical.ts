import type { Request } from "express";
import type * as clinical from "./dbClinical";
import type { saveZBenefit } from "./dbZBenefit";
import { prepareClinicalCatalog } from "./dbClinical";
import { restoreDates, rustRequest } from "./rustBackend";

type Writes = Pick<
  typeof clinical,
  | "addService"
  | "recordResult"
  | "addLabResult"
  | "addLabResults"
  | "updateService"
  | "setChecklist"
  | "setChecklistMany"
  | "addAppointment"
  | "cancelAppointment"
  | "fileClaim"
> & { saveZBenefit: typeof saveZBenefit };

export async function rustClinicalAction<K extends keyof Writes>(
  req: Request,
  action: K,
  input: Parameters<Writes[K]>[0]
): Promise<Awaited<ReturnType<Writes[K]>>> {
  await prepareClinicalCatalog();
  return rustRequest<Awaited<ReturnType<Writes[K]>>>(
    req,
    `/api/rust/clinical/actions/${action}`,
    {},
    input
  );
}

export async function rustClinicalAppointments(
  req: Request
): Promise<Awaited<ReturnType<typeof clinical.listAllAppointments>>> {
  await prepareClinicalCatalog();
  const rows = await rustRequest<
    Awaited<ReturnType<typeof clinical.listAllAppointments>>
  >(req, "/api/rust/clinical/appointments");
  return rows.map(row => restoreDates(row));
}

export async function rustZBenefit(
  req: Request
): Promise<Awaited<ReturnType<typeof clinical.listZBenefit>>> {
  await prepareClinicalCatalog();
  return rustRequest(req, "/api/rust/clinical/z-benefit");
}
