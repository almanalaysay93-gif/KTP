import { STAGE_ADMIN_LABEL } from "@/lib/ktpLabels";
import type { analyzeMetrics } from "@shared/metricsAnalysis";
import type { PatientStage } from "@shared/ktp";
import type { ReactNode } from "react";

type Analysis = ReturnType<typeof analyzeMetrics>;
function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="clay-1 min-w-0 rounded-2xl bg-surface-1 p-4 sm:p-6">
    <h2 className="type-headline">{title}</h2>
    {description && <p className="type-caption mt-2 text-ink-muted">{description}</p>}
    <div className="mt-4">{children}</div>
  </section>;
}
function Counts({ rows }: { rows: readonly (readonly [string, number | string])[] }) {
  return <dl className="type-body-sm divide-y divide-hairline">{rows.map(([label, count]) => <div key={label} className="flex items-start justify-between gap-4 py-3"><dt className="min-w-0">{label}</dt><dd className="min-w-0 max-w-1/2 shrink-0 text-right font-bold tabular-nums">{typeof count === "number" ? count.toLocaleString() : count}</dd></div>)}</dl>;
}
const average = (days: number | null, samples: number) => days === null ? "Unknown" : `${days} days (${samples} records)`;

export function MetricsAnalysis({ data }: { data: Analysis }) {
  return <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
    <Panel title="M1 · Readiness" description="Tracking indicator: active Phase 3 recipient, completed or NA required checklist items, both ethics approvals marked Done, and an active linked Phase 3 donor meeting the same requirements. Optional items count when recorded. Clinical approval remains with the transplant team.">
      <Counts rows={[["Ready by recorded requirements", data.ready], ["Recipients awaiting transplant", data.candidates], ["Recipients with blockers", data.blocked]]} />
    </Panel>
    <Panel title="M2 · Blocked cases" description="Pre-transplant recipients grouped by outstanding requirement. One recipient can have several blockers.">
      {data.blockers.length ? <Counts rows={data.blockers.map(row => [row.reason, row.count])} /> : <p className="type-body-sm">No recorded blockers.</p>}
    </Panel>
    <Panel title="M3 · Waiting time" description="Enrollment uses profile creation date. Imported records may start later than actual enrollment. Stage averages include only logged stage transitions. Historical stage-entry dates and ethics referral dates are unavailable.">
      <Counts rows={[["Average since enrollment, preoperative profiles", average(data.waiting.enrollmentAverageDays, data.waiting.enrollmentSamples)], ["Average enrollment to transplant", average(data.waiting.transplantAverageDays, data.waiting.transplantSamples)], ["Profiles without known stage-entry date", data.waiting.stageUnknown]]} />
      <h3 className="type-body-sm mt-4 font-bold">Average days in current stage</h3>
      <Counts rows={data.waiting.stages.map(row => [STAGE_ADMIN_LABEL[row.stage as PatientStage] ?? row.stage, average(row.averageDays, row.samples)])} />
    </Panel>
    <Panel title="M4 · Donor matching" description="Pre-transplant recipients. Linked donors must be active and pre-donation. Qualified means Phase 3 with required checklist items complete and both ethics approvals recorded.">
      <Counts rows={[["Recipients without active linked donor", data.matching.withoutDonor], ["Recipients with donors under evaluation", data.matching.underEvaluation], ["Recipients with qualified linked donor", data.matching.qualifiedDonor]]} />
    </Panel>
    <Panel title="M5 · Ethics progress" description="Preoperative recipient and donor profiles. Approved requires Ethics committee and HTEC evaluation and approval both marked Done. Missing progress counts as awaiting review.">
      <Counts rows={[["Awaiting review or approval", data.ethics.awaiting], ["Approved", data.ethics.approved], ["Not applicable", data.ethics.notApplicable], ["Missing ethics catalog", data.ethics.unknown], ["Average ethics waiting time", "Unknown"]]} />
    </Panel>
    <Panel title="M7 · Follow-up compliance" description="Overdue labs use planned service due dates. Past follow-ups show scheduled dates, not missed visits. Attendance is not recorded, so missed visits and attendance rates are unavailable.">
      <Counts rows={[["Overdue laboratory / tacrolimus services", data.followup.overdueLabs], ["Patients with overdue labs", data.followup.patientsWithOverdueLabs], ["Past scheduled follow-ups", data.followup.pastFollowups], ["Past scheduled post-KT follow-ups", data.followup.pastPostTransplantFollowups], ["Uncancelled reschedule requests", data.followup.rescheduleRequests], ["Missed visits", "Unknown"]]} />
    </Panel>
    <Panel title="M8 · Z Benefit claims" description="Recipient service records marked Done or Superseded. Due soon means today through seven days ahead. Pending includes overdue, due soon, later, and missing-deadline claims.">
      <Counts rows={[["Pending filing", data.claims.pending], ["Due within seven days", data.claims.dueSoon], ["Overdue", data.claims.overdue], ["Filed", data.claims.filed], ["Pending without deadline", data.claims.missingDeadline]]} />
    </Panel>
    <Panel title="M6 · Monthly activity" description="Last 12 months. New recipients and donors use profile creation dates. Completed transplants and donations use recorded surgery dates. Counts follow the selected current patient status.">
      <div className="type-caption grid grid-cols-3 gap-3 border-b border-hairline pb-3 font-bold"><span>Month</span><span>New profiles<br />Recipient / donor</span><span>Surgeries<br />KT / donation</span></div>
      {data.monthly.map(row => <div key={row.month} className="type-body-sm grid grid-cols-3 gap-3 border-b border-hairline py-3 last:border-0"><span>{row.month}</span><span className="tabular-nums">{row.recipients} / {row.donors}</span><span className="tabular-nums">{row.transplants} / {row.donations}</span></div>)}
    </Panel>
  </div>;
}
