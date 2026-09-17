/** Insights report: Node reads the roster, license, and training data and sends a
 * digest to the rule-based Python service (inquiry/insights_report.py), which
 * writes the report. No AI model is called. */
import * as db from "../db";
import { buildTrainingCompliance } from "../reportBuilders";
import { dateKey, INACTIVE_EMPLOYMENT_STATUSES, nurseFullName } from "../../shared/nursetrack";

export const INSIGHTS_TIMEOUT_MS = 5000;
export const INSIGHTS_UNAVAILABLE_MESSAGE = "The insights report service is not available. Try again later.";

export type InsightsSection = { code: string; title: string; lines: string[] };
export type InsightsReport = { generatedFor: string; sections: InsightsSection[]; text: string };

export type InsightsDigest = {
  today_manila: string;
  areas: { name: string }[];
  staff: { name: string; area: string }[];
  licenses: { name: string; area: string; credential: string; expiry_date: string; renewed: boolean }[];
  trainings: { name: string; area: string; training: string; date: string }[];
  coverage: { area: string; required_checks: number; compliant_checks: number }[];
};

export class InsightsServiceError extends Error {}

export async function buildInsightsDigest(today: string): Promise<InsightsDigest> {
  const [nurses, areas, credentials, trainingRecords, credentialTypes, trainingCatalog, requirements] = await Promise.all([
    db.listNurses(),
    db.listAreas(false),
    db.listCredentials(),
    db.listNurseTrainings(),
    db.listCredentialTypes(false),
    db.listTrainingCatalog(false),
    db.listRequiredTrainings(),
  ]);

  const inactive = new Set<string>(INACTIVE_EMPLOYMENT_STATUSES);
  const active = nurses.filter((n) => !n.archivedAt && !inactive.has(n.employmentStatus));
  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  const areaOf = (areaId: number | null) => (areaId ? areaName.get(areaId) ?? "Unassigned" : "Unassigned");
  const person = new Map(active.map((n) => [n.id, { name: nurseFullName(n), area: areaOf(n.currentAreaId) }]));
  const credentialName = new Map(credentialTypes.map((t) => [t.id, t.name]));
  const trainingName = new Map(trainingCatalog.map((t) => [t.id, t.name]));

  // Latest-expiring credential per person, the same rule as the staff list.
  const latest = new Map<number, (typeof credentials)[number]>();
  for (const c of credentials) {
    if (!person.has(c.nurseId)) continue;
    const prev = latest.get(c.nurseId);
    if (!prev || dateKey(c.expiryDate) > dateKey(prev.expiryDate)) latest.set(c.nurseId, c);
  }
  const licenses = Array.from(latest.values()).flatMap((c) => {
    const expiry = dateKey(c.expiryDate);
    if (!expiry) return [];
    const p = person.get(c.nurseId)!;
    return [{ ...p, credential: credentialName.get(c.credentialTypeId) ?? "License", expiry_date: expiry, renewed: c.renewalStatus === "Renewed" }];
  });

  const trainings = trainingRecords.flatMap((t) => {
    const p = person.get(t.nurseId);
    const date = dateKey(t.scheduledDate);
    if (!p || t.status !== "Scheduled" || !date) return [];
    return [{ ...p, training: trainingName.get(t.trainingId) ?? "Training", date }];
  });

  const coverage = buildTrainingCompliance({
    areas,
    requirements,
    nurses: active,
    completedRecords: trainingRecords.filter((t) => t.status === "Completed"),
    today,
  }).map((row) => ({ area: row.areaName, required_checks: row.requiredChecks, compliant_checks: row.compliantChecks }));

  return {
    today_manila: today,
    areas: areas.map((a) => ({ name: a.name })),
    staff: Array.from(person.values()),
    licenses,
    trainings,
    coverage,
  };
}

/** Sends the digest to the Python service. Any failure becomes one clear message. */
export async function requestInsightsReport(
  digest: InsightsDigest,
  options: { serviceUrl?: string; secret?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<InsightsReport> {
  const serviceUrl = options.serviceUrl ?? process.env.INQUIRY_SERVICE_URL ?? "http://127.0.0.1:5005";
  const secret = options.secret ?? process.env.INQUIRY_SERVICE_SECRET;
  const doFetch = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers.Authorization = `Bearer ${secret}`;

  let response: Response;
  try {
    response = await doFetch(`${serviceUrl}/api/insights/report`, {
      method: "POST",
      headers,
      body: JSON.stringify({ digest }),
      signal: AbortSignal.timeout(options.timeoutMs ?? INSIGHTS_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn("[Insights] report service unreachable:", err instanceof Error ? err.message : err);
    throw new InsightsServiceError(INSIGHTS_UNAVAILABLE_MESSAGE);
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    console.warn(`[Insights] report service returned non-JSON (HTTP ${response.status})`);
    throw new InsightsServiceError(INSIGHTS_UNAVAILABLE_MESSAGE);
  }
  if (!response.ok || !body?.success || !Array.isArray(body.sections)) {
    console.warn(`[Insights] report service error (HTTP ${response.status}):`, body?.error ?? "no sections");
    throw new InsightsServiceError(INSIGHTS_UNAVAILABLE_MESSAGE);
  }
  return {
    generatedFor: String(body.generated_for ?? digest.today_manila),
    sections: body.sections.map((s: any) => ({
      code: String(s.code),
      title: String(s.title),
      lines: Array.isArray(s.lines) ? s.lines.map(String) : [],
    })),
    text: String(body.text ?? ""),
  };
}

export async function generateInsightsReport(today: string): Promise<InsightsReport> {
  return requestInsightsReport(await buildInsightsDigest(today));
}
