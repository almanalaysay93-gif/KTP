import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useLocation } from "wouter";
import {
  AdminShell, AdminToaster, BellButton, SearchField, ServiceActionDialog, StageBoard, TriagePanel, TriageTray,
  fmtLongDate, triageCounts, useAdminToast, usePreviewState,
  type RowActions, type ServiceAction, type TriageCellId, type TriageSelection,
} from "@/components/ktp/admin";
import { MotionClayButton, MotionRoot, OrganGridBackdrop, PageTransition } from "@/components/motion";
import { FEATURED_PATIENT_ID, MOCK_DATASET, MOCK_TODAY, dashboardAggregates } from "./mock";
import { SampleDataBadge } from "./PreviewRoutes";

/* Admin dashboard wow screen (DESIGN.md Screens 2, spec 7.1). Fictional data; every count is derived. */

const HREFS = { dashboard: "/admin", patients: "/patient" } as const;
const EMPTY_DATA = { ...MOCK_DATASET, patients: [], serviceRecords: [], appointments: [] };

export default function AdminDashboardPreview() {
  useEffect(() => {
    document.title = "Dashboard | KTP";
  }, []);

  return (
    <MotionRoot intensity="full">
      <AdminToaster>
        <div data-surface="admin" className="relative isolate min-h-dvh bg-ground text-ink">
          <OrganGridBackdrop />
          <Dashboard />
        </div>
      </AdminToaster>
    </MotionRoot>
  );
}

function Dashboard() {
  const toast = useAdminToast();
  const [, navigate] = useLocation();
  const [previewState, retry] = usePreviewState();
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<TriageSelection>({ kind: "cell", id: "overdue" });
  const [action, setAction] = useState<ServiceAction | null>(null);

  const data = previewState === "empty" ? EMPTY_DATA : MOCK_DATASET;
  const aggregates = useMemo(() => dashboardAggregates(data, MOCK_TODAY), [data]);
  const counts = useMemo(() => triageCounts(aggregates, data, MOCK_TODAY), [aggregates, data]);
  const regionState = previewState === "empty" ? "ready" : previewState;

  const previewOnly = (label: string) =>
    toast({ title: "Preview only", body: `${label} is not part of this preview.`, tone: "info" });

  const actions: RowActions = {
    onOpenPatient: (patient) => {
      if (patient.id === FEATURED_PATIENT_ID) navigate(HREFS.patients);
      else toast({ title: "Preview only", body: "Only the featured sample patient has a profile in this preview.", tone: "info" });
    },
    onMarkFiled: (patient, record) => setAction({ kind: "claim", patient, record }),
    onSetNewTime: (row) => setAction({ kind: "reschedule", patient: row.patient, appointment: row.appointment }),
  };

  const bellCount = aggregates.rescheduleRequests.length;
  const enroll = () => previewOnly("Enroll patient");

  return (
    <AdminShell
      current="dashboard"
      hrefs={HREFS}
      mobileTitle="Dashboard"
      skipTo="triage"
      skipLabel="Skip to triage"
      mobileActions={
        <>
          <BellButton count={bellCount} onClick={() => previewOnly("Notifications")} />
          <MotionClayButton variant="icon" size="sm" aria-label="Enroll patient" onClick={enroll}>
            <Plus strokeWidth={1.75} />
          </MotionClayButton>
        </>
      }
    >
      <PageTransition routeKey="dashboard" focusHeading={false}>
        <main className="mx-auto w-full max-w-[1120px] px-4 pb-16 md:px-6 lg:px-8 lg:pb-20">
          <header className="flex flex-col gap-4 pt-3 lg:flex-row lg:items-end lg:justify-between lg:pt-8">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <p className="type-body-sm text-ink-muted">{fmtLongDate(MOCK_TODAY)}</p>
                <SampleDataBadge />
              </div>
              <h1 className="type-display text-ink">Dashboard</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <SearchField value={query} onChange={setQuery} className="min-w-0 flex-1 lg:w-72 lg:flex-none" />
              <BellButton count={bellCount} onClick={() => previewOnly("Notifications")} className="max-lg:hidden" />
              <MotionClayButton icon={<Plus strokeWidth={1.75} />} onClick={enroll} className="max-lg:hidden">
                Enroll patient
              </MotionClayButton>
            </div>
          </header>

          <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-12 lg:items-start">
            <section id="triage" tabIndex={-1} aria-label="Triage" className="min-w-0 rounded-2xl outline-none lg:col-span-7">
              <TriageTray
                counts={counts}
                selection={selection}
                onSelect={(id: TriageCellId) => setSelection({ kind: "cell", id })}
                panelId="triage-panel"
                state={regionState}
                onRetry={retry}
              />
            </section>
            <div className="min-w-0 lg:col-span-5">
              <TriagePanel
                id="triage-panel"
                selection={selection}
                aggregates={aggregates}
                query={query}
                actions={actions}
                state={regionState}
                onRetry={retry}
              />
            </div>
          </div>

          <div className="mt-6">
            <StageBoard
              recipients={aggregates.recipientStages}
              donors={aggregates.donorStages}
              selection={selection}
              onSelectStage={(patientType, stage) => setSelection({ kind: "stage", patientType, stage })}
              panelId="triage-panel"
              state={previewState}
              onRetry={retry}
              onEnroll={enroll}
            />
          </div>
        </main>
      </PageTransition>
      <ServiceActionDialog action={action} onClose={() => setAction(null)} />
    </AdminShell>
  );
}
