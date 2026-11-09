import type { Request } from "express";
import type { ImportRow, CheckedRow } from "./dbPatientImport";
import { rustRequest } from "./rustBackend";
import { prepareClinicalCatalog } from "./dbClinical";

export async function rustImportCheck(
  req: Request,
  rows: ImportRow[]
): Promise<CheckedRow[]> {
  await prepareClinicalCatalog();
  return rustRequest(req, "/api/rust/admin/patient-import/check", {}, { rows });
}
export async function rustImportCommit(
  req: Request,
  rows: ImportRow[],
  fileName: string
): Promise<{ count: number; ids: number[] }> {
  await prepareClinicalCatalog();
  return rustRequest(
    req,
    "/api/rust/admin/patient-import/commit",
    {},
    { rows, fileName }
  );
}
