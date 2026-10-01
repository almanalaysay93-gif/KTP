import { useEffect, useState } from "react";
import { ArrowLeft, Edit3, Archive, UserX } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import {
  AdminShell,
  AdminToaster,
  PatientHeader,
  PatientTray,
  ServiceRecordsTable,
  ServiceActionDialog,
  useAdminToast,
  type ServiceAction,
} from "@/components/ktp/admin";
import { ClayButton, ClayCard, ClayTabs, ClayTabsList, ClayTabsTrigger, ClayTabsContent } from "@/components/clay";
import { MotionRoot, OrganGridBackdrop, PageTransition } from "@/components/motion";
import { trpc } from "@/lib/trpc";
import { todayDate } from "@shared/ktp";

const ADMIN_HREFS = {
  dashboard: "/dashboard",
  patients: "/patients",
  calendar: "/calendar",
  messages: "/messages",
  settings: "/settings",
} as const;

export default function PatientDetailPage(props: { id?: string }) {
  const routeParams = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const toast = useAdminToast();
  const rawId = props.id ?? routeParams.id ?? "0";
  const patientId = parseInt(rawId, 10);
  const [tab, setTab] = useState<string>("tracker");
  const [action, setAction] = useState<ServiceAction | null>(null);

  const query = trpc.patients.getById.useQuery(
    { id: patientId },
    {
      enabled: Boolean(patientId),
    }
  );

  const activityQuery = trpc.patients.activityLogs.useQuery(
    { patientId, limit: 30 },
    {
      enabled: Boolean(patientId) && tab === "history",
    }
  );

  const doctorsQuery = trpc.doctors.list.useQuery();
  const doctorsMap = new Map((doctorsQuery.data ?? []).map((d) => [d.id, d.name]));

  useEffect(() => {
    // No names in document titles (DESIGN.md Don'ts)
    document.title = "Patient profile | KTP";
  }, []);

  if (query.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ground text-ink-muted">
        Loading patient profile...
      </div>
    );
  }

  const patient = query.data?.patient;
  if (!patient) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ground text-ink">
        <p className="type-headline">Patient not found</p>
        <ClayButton variant="secondary" onClick={() => navigate("/patients")}>
          Back to patients
        </ClayButton>
      </div>
    );
  }

  const nephrologist = patient.nephrologistId ? doctorsMap.get(patient.nephrologistId) ?? "—" : "—";
  const fellow = patient.fellowId ? doctorsMap.get(patient.fellowId) ?? "—" : "—";
  const linkedRecipient = query.data?.linkedRecipient;
  const linkedDonors = query.data?.linkedDonors ?? [];

  return (
    <MotionRoot intensity="full">
      <AdminToaster>
        <div data-surface="admin" className="relative isolate min-h-dvh bg-ground text-ink">
          <OrganGridBackdrop />
          <AdminShell
            current="patients"
            hrefs={ADMIN_HREFS}
            mobileTitle="Patient Profile"
            skipTo="patient-detail"
            skipLabel="Skip to profile content"
          >
            <PageTransition routeKey="patient-profile" focusHeading={false}>
              <main id="patient-detail" className="mx-auto w-full max-w-[1120px] px-4 pb-16 md:px-6 lg:px-8 lg:pb-20">
                {/* Header Back & Actions */}
                <div className="flex items-center justify-between pt-4 lg:pt-8">
                  <button
                    type="button"
                    onClick={() => navigate("/patients")}
                    className="clay-focus inline-flex items-center gap-2 rounded-full p-2 text-ink-muted hover:bg-surface-2"
                  >
                    <ArrowLeft className="size-5" />
                    <span className="type-body-sm">All patients</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <ClayButton
                      variant="secondary"
                      icon={<Edit3 className="size-4" />}
                      onClick={() => navigate(`/patients/${patient.id}/edit`)}
                    >
                      Edit record
                    </ClayButton>
                  </div>
                </div>

                {/* Patient Header Card */}
                <div className="mt-4">
                  <PatientHeader
                    patient={patient as any}
                    linked={(linkedRecipient ?? linkedDonors[0]) as any ?? null}
                    doctors={[nephrologist, fellow].filter(Boolean) as any}
                    backHref="/patients"
                    onRecordResult={() => setAction({ kind: "claim", patient: patient as any, record: null as any })}
                    onSendMessage={() => navigate("/messages")}
                    onEdit={() => navigate(`/patients/${patient.id}/edit`)}
                    onOpenLinked={(linked) => navigate(`/patients/${linked.id}`)}
                  />
                </div>

                {/* Tabs */}
                <div className="mt-6">
                  <ClayTabs value={tab} onValueChange={setTab}>
                    <ClayTabsList>
                      <ClayTabsTrigger value="tracker">Tracker</ClayTabsTrigger>
                      <ClayTabsTrigger value="labs">Labs</ClayTabsTrigger>
                      <ClayTabsTrigger value="checklist">Checklist</ClayTabsTrigger>
                      <ClayTabsTrigger value="appointments">Appointments</ClayTabsTrigger>
                      <ClayTabsTrigger value="history">History</ClayTabsTrigger>
                    </ClayTabsList>

                    <ClayTabsContent value="tracker" className="mt-6">
                      <ClayCard className="p-6 text-center text-ink-muted">
                        <p className="type-headline text-ink">Service Tracker</p>
                        <p className="mt-2 type-body-sm">
                          Scheduled Meds, Laboratory, Tacro, and X-ray/USD records for this patient will be connected in Phase A3.
                        </p>
                      </ClayCard>
                    </ClayTabsContent>

                    <ClayTabsContent value="labs" className="mt-6">
                      <ClayCard className="p-6 text-center text-ink-muted">
                        <p className="type-headline text-ink">Lab Results</p>
                        <p className="mt-2 type-body-sm">
                          Laboratory values and longitudinal trend charts will be connected in Phase A3.
                        </p>
                      </ClayCard>
                    </ClayTabsContent>

                    <ClayTabsContent value="checklist" className="mt-6">
                      <ClayCard className="p-6 text-center text-ink-muted">
                        <p className="type-headline text-ink">Workup Checklist</p>
                        <p className="mt-2 type-body-sm">
                          Pre-transplant workup items and clearances will be connected in Phase A3.
                        </p>
                      </ClayCard>
                    </ClayTabsContent>

                    <ClayTabsContent value="appointments" className="mt-6">
                      <ClayCard className="p-6 text-center text-ink-muted">
                        <p className="type-headline text-ink">Appointments</p>
                        <p className="mt-2 type-body-sm">
                          Clinical appointment scheduling and confirmations will be connected in Phase A3.
                        </p>
                      </ClayCard>
                    </ClayTabsContent>

                    <ClayTabsContent value="history" className="mt-6">
                      <ClayCard className="p-6">
                        <h3 className="type-headline text-ink">Audit Log</h3>
                        <p className="type-body-sm text-ink-muted">
                          Admin access, profile edits, and consent history (RA 10173 compliance).
                        </p>
                        <div className="mt-4 divide-y divide-hairline">
                          {activityQuery.data && activityQuery.data.length > 0 ? (
                            activityQuery.data.map((log) => (
                              <div key={log.id} className="py-3">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono type-label text-ink">{log.action}</span>
                                  <span className="type-body-sm text-ink-muted">
                                    {new Date(log.createdAt).toLocaleString()}
                                  </span>
                                </div>
                                {log.details && (
                                  <p className="mt-1 font-mono text-ink-muted type-body-sm">
                                    {log.details}
                                  </p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="py-6 text-center type-body-sm text-ink-muted">
                              No activity recorded yet.
                            </p>
                          )}
                        </div>
                      </ClayCard>
                    </ClayTabsContent>
                  </ClayTabs>
                </div>
              </main>
            </PageTransition>
            <ServiceActionDialog action={action} onClose={() => setAction(null)} />
          </AdminShell>
        </div>
      </AdminToaster>
    </MotionRoot>
  );
}
