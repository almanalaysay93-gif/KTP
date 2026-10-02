import { PatientClinicalTabs } from "@/components/ktp/admin/PatientClinicalTabs";
import { PatientProfileBoundary } from "@/components/ktp/PatientProfileBoundary";
import {
  parsePatientId,
  toPatientView,
  toDoctorView,
} from "@/lib/ktpPatientView";
import { ADMIN_HREFS } from "@/lib/ktpAdminRoutes";
import { useEffect, useState } from "react";
import { ArrowLeft, Edit3 } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import {
  AdminShell,
  AdminToaster,
  PatientHeader,
} from "@/components/ktp/admin";
import {
  ClayButton,
  ClayCard,
  ClayTabs,
  ClayTabsList,
  ClayTabsTrigger,
  ClayTabsContent,
} from "@/components/clay";
import {
  MotionRoot,
  OrganGridBackdrop,
  PageTransition,
} from "@/components/motion";
import { trpc } from "@/lib/trpc";
import { todayDate } from "@shared/ktp";

export default function PatientDetailPage(props: { id?: string }) {
  const params = useParams<{ id: string }>();
  const rawId = props.id ?? params.id;
  const utils = trpc.useUtils();
  return (
    <MotionRoot intensity="full">
      <AdminToaster>
        <div
          data-surface="admin"
          className="relative isolate min-h-dvh bg-ground text-ink"
        >
          <OrganGridBackdrop />
          <AdminShell
            current="patients"
            hrefs={ADMIN_HREFS}
            hideUnavailable
            mobileTitle="Patient Profile"
            skipTo="patient-detail"
            skipLabel="Skip to profile content"
          >
            <PatientProfileBoundary
              key={rawId}
              onRetry={async () => {
                const id = parsePatientId(rawId);
                if (id === null) return;
                await utils.patients.getById.invalidate({ id, allowMissing: true });
                await utils.patients.getById.fetch({ id, allowMissing: true });
              }}
            >
              <PatientContent rawId={rawId} />
            </PatientProfileBoundary>
          </AdminShell>
        </div>
      </AdminToaster>
    </MotionRoot>
  );
}

function PatientContent({ rawId }: { rawId: string | undefined }) {
  const [, navigate] = useLocation();
  const patientId = parsePatientId(rawId);
  const today = todayDate();
  const [tab, setTab] = useState<string>(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    return ["tracker", "labs", "checklist", "appointments", "history"].includes(requested ?? "") ? requested! : "tracker";
  });

  const query = trpc.patients.getById.useQuery(
    { id: patientId ?? 0, allowMissing: true },
    {
      enabled: Boolean(patientId),
    }
  );

  const activityQuery = trpc.patients.activityLogs.useQuery(
    { patientId: patientId ?? 0, limit: 30 },
    {
      enabled: Boolean(patientId) && tab === "history",
    }
  );

  const doctorsQuery = trpc.doctors.list.useQuery();

  useEffect(() => {
    // No names in document titles (DESIGN.md Don'ts)
    document.title = "Patient profile | KTP";
  }, []);

  if (patientId === null || query.isError) {
    const code = query.error?.data?.code;
    const message =
      patientId === null
        ? "Invalid patient ID"
        : code === "NOT_FOUND"
          ? "Patient not found"
          : code === "FORBIDDEN" || code === "UNAUTHORIZED"
            ? "Patient access denied"
            : "Could not load patient profile";
    return (
      <div
        id="patient-detail"
        role="alert"
        className="flex flex-col items-start gap-4 p-6"
      >
        <h1 className="type-title">{message}</h1>
        {patientId !== null && code !== "NOT_FOUND" ? (
          <ClayButton onClick={() => query.refetch()}>Retry</ClayButton>
        ) : null}
        <Link
          href="/patients"
          className="clay-focus inline-flex min-h-11 items-center text-brick"
        >
          Back to patients
        </Link>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ground text-ink-muted">
        Loading patient profile...
      </div>
    );
  }

  const sourcePatient = query.data?.patient;
  if (!sourcePatient) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ground text-ink">
        <p className="type-headline">Patient not found</p>
        <ClayButton variant="secondary" onClick={() => navigate("/patients")}>
          Back to patients
        </ClayButton>
      </div>
    );
  }

  const patient = toPatientView(sourcePatient, today);
  const linkedRecipient = query.data?.linkedRecipient
    ? toPatientView(query.data.linkedRecipient, today)
    : null;
  const linkedDonors = (query.data?.linkedDonors ?? []).map(p =>
    toPatientView(p, today)
  );

  return (
    <>
      <PageTransition
        routeKey={`patient-profile-${patientId}`}
        focusHeading={false}
      >
        <main
          id="patient-detail"
          className="mx-auto w-full max-w-[1120px] px-4 pb-16 md:px-6 lg:px-8 lg:pb-20"
        >
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
              patient={patient}
              today={today}
              linked={linkedRecipient ?? linkedDonors[0] ?? null}
              doctors={(doctorsQuery.data ?? []).map(toDoctorView)}
              backHref="/patients"
              onRecordResult={() => {
                setTab("tracker");
                requestAnimationFrame(() => document.getElementById("clinical-content")?.scrollIntoView({ block: "start" }));
              }}
              onEdit={() => navigate(`/patients/${patient.id}/edit`)}
              onOpenLinked={linked => navigate(`/patients/${linked.id}`)}
            />
          </div>

          {/* Tabs */}
          <div className="mt-6">
            <ClayTabs value={tab} onValueChange={setTab}>
              <ClayTabsList className="h-auto w-full flex-wrap overflow-visible rounded-2xl sm:w-fit">
                <ClayTabsTrigger value="tracker">Tracker</ClayTabsTrigger>
                <ClayTabsTrigger value="labs">Labs</ClayTabsTrigger>
                <ClayTabsTrigger value="checklist">Checklist</ClayTabsTrigger>
                <ClayTabsTrigger value="appointments">
                  Appointments
                </ClayTabsTrigger>
                <ClayTabsTrigger value="history">History</ClayTabsTrigger>
              </ClayTabsList>

              {["tracker", "labs", "checklist", "appointments"].map(value => (
                <ClayTabsContent key={value} value={value} className="mt-6">
                  <div id={tab === value ? "clinical-content" : undefined} className="scroll-mt-20">
                    <PatientClinicalTabs patientId={patientId} tab={value} />
                  </div>
                </ClayTabsContent>
              ))}

              <ClayTabsContent value="history" className="mt-6">
                <ClayCard className="p-6">
                  <h3 className="type-headline text-ink">Audit Log</h3>
                  <p className="type-body-sm text-ink-muted">
                    Admin access, profile edits, and consent history (RA 10173
                    compliance).
                  </p>
                  <div className="mt-4 divide-y divide-hairline">
                    {activityQuery.data && activityQuery.data.length > 0 ? (
                      activityQuery.data.map(log => (
                        <div key={log.id} className="py-3">
                          <div className="flex items-center justify-between">
                            <span className="font-mono type-label text-ink">
                              {log.action}
                            </span>
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
    </>
  );
}
