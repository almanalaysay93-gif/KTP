import { execute, query } from "./dbClinical";
import { summarizeMetrics, type MetricsPatient } from "../shared/metrics";
import type { PatientStatus } from "../shared/ktp";
import { todayDate } from "../shared/ktp";
import { analyzeMetrics, type AnalysisPatient, type AnalysisChecklist, type AnalysisService, type AnalysisAppointment, type StageEvent } from "../shared/metricsAnalysis";

export async function listMetrics(status?: PatientStatus) {
  return execute(function* () {
    const rows = yield query(`SELECT p."patientType", p.stage, p.status,
      CASE WHEN EXISTS (
        SELECT 1 FROM "checklistCatalog" c
        LEFT JOIN "patientChecklist" pc ON pc."catalogId" = c.id AND pc."patientId" = p.id
        WHERE c.name = 'Ethics committee' AND c.active = true
          AND (c."appliesTo" = 'Both' OR c."appliesTo" = p."patientType")
          AND COALESCE(pc.status, 'Pending') = 'Pending'
      ) THEN 'Pending' ELSE NULL END AS "ethicsStatus"
      FROM patients p
      ${status ? "WHERE p.status = ?" : ""}`, ...(status ? [status] : []));
    const patients = yield query('SELECT id, "patientType", status, stage, "linkedRecipientId", "createdAt", "surgeryDate" FROM patients');
    const checklist = yield query(`SELECT p.id AS "patientId", c.name, c.category,
      COALESCE(pc.status, 'Pending') AS status, c."asIndicated",
      CASE WHEN pc.id IS NULL THEN 0 ELSE 1 END AS recorded
      FROM patients p JOIN "checklistCatalog" c ON c.active = true
        AND (c."appliesTo" = 'Both' OR c."appliesTo" = p."patientType")
      LEFT JOIN "patientChecklist" pc ON pc."patientId" = p.id AND pc."catalogId" = c.id`);
    const services = yield query('SELECT "patientId", "serviceType", status, "dueDate", "claimDeadline", "claimFiledDate" FROM "serviceRecords"');
    const appointments = yield query('SELECT "patientId", kind, "startsAt", "cancelledAt", response FROM appointments');
    const stageEvents = yield query(`SELECT "patientId", "createdAt", details FROM "activityLog" WHERE action IN ('UPDATE_PATIENT', 'ENROLL_PATIENT') ORDER BY "createdAt", id`);
    return { ...summarizeMetrics(rows as MetricsPatient[]), analysis: analyzeMetrics({
      patients: patients as AnalysisPatient[], checklist: checklist as AnalysisChecklist[],
      services: services as AnalysisService[], appointments: appointments as AnalysisAppointment[],
      stageEvents: stageEvents as StageEvent[], today: todayDate(), status,
    }) };
  });
}
