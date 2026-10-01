import { liveDashboardData, liveDashboardAggregates } from "@/lib/ktpDashboard";
import { toPatientView } from "@/lib/ktpPatientView";
import { ADMIN_HREFS } from "@/lib/ktpAdminRoutes";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useLocation } from "wouter";
import {
  AdminShell,
  AdminToaster,
  SearchField,
  ServiceActionDialog,
  StageBoard,
  TriagePanel,
  TriageTray,
  triageCounts,
  fmtLongDate,
  type RowActions,
  type ServiceAction,
  type TriageCellId,
  type TriageSelection,
} from "@/components/ktp/admin";
import {
  MotionClayButton,
  MotionRoot,
  OrganGridBackdrop,
  PageTransition,
} from "@/components/motion";
import { trpc } from "@/lib/trpc";
import { todayDate } from "@shared/ktp";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<TriageSelection>({
    kind: "cell",
    id: "overdue",
  });
  const [action, setAction] = useState<ServiceAction | null>(null);

  const dashQuery = trpc.dashboard.initial.useQuery();
  const today = dashQuery.data?.today ?? todayDate();
  const data = useMemo(
    () =>
      liveDashboardData(
        (dashQuery.data?.patients ?? []).map(p => toPatientView(p, today))
      ),
    [dashQuery.data, today]
  );
  const aggregates = useMemo(() => liveDashboardAggregates(data), [data]);
  const counts = useMemo(
    () => triageCounts(aggregates, data, today),
    [aggregates, data, today]
  );
  const state = dashQuery.isLoading
    ? "loading"
    : dashQuery.isError
      ? "error"
      : "ready";

  useEffect(() => {
    document.title = "Dashboard | KTP";
  }, []);

  const actions: RowActions = {
    onOpenPatient: patient => {
      navigate(`/patients/${patient.id}`);
    },
    onMarkFiled: (patient, record) =>
      setAction({ kind: "claim", patient, record }),
    onSetNewTime: row =>
      setAction({
        kind: "reschedule",
        patient: row.patient,
        appointment: row.appointment,
      }),
  };

  const enroll = () => navigate("/patients/new");

  return (
    <MotionRoot intensity="full">
      <AdminToaster>
        <div
          data-surface="admin"
          className="relative isolate min-h-dvh bg-ground text-ink"
        >
          <OrganGridBackdrop />
          <AdminShell
            current="dashboard"
            hrefs={ADMIN_HREFS}
            hideUnavailable
            mobileTitle="Dashboard"
            skipTo="triage"
            skipLabel="Skip to triage"
            mobileActions={
              <>
                <MotionClayButton
                  variant="icon"
                  size="sm"
                  aria-label="Enroll patient"
                  onClick={enroll}
                >
                  <Plus strokeWidth={1.75} />
                </MotionClayButton>
              </>
            }
          >
            <PageTransition routeKey="dashboard" focusHeading={false}>
              <main className="mx-auto w-full max-w-[1120px] px-4 pb-16 md:px-6 lg:px-8 lg:pb-20">
                <header className="flex flex-col gap-4 pt-3 lg:flex-row lg:items-end lg:justify-between lg:pt-8">
                  <div className="flex flex-col gap-1">
                    <p className="type-body-sm text-ink-muted">
                      {fmtLongDate(today)}
                    </p>
                    <h1 className="type-display text-ink">Dashboard</h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <SearchField
                      value={query}
                      onChange={setQuery}
                      className="min-w-0 flex-1 lg:w-72 lg:flex-none"
                    />
                    <MotionClayButton
                      icon={<Plus strokeWidth={1.75} />}
                      onClick={enroll}
                      className="max-lg:hidden"
                    >
                      Enroll patient
                    </MotionClayButton>
                  </div>
                </header>

                <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-12 lg:items-start">
                  <section
                    id="triage"
                    tabIndex={-1}
                    aria-label="Triage"
                    className="min-w-0 rounded-2xl outline-none lg:col-span-7"
                  >
                    <TriageTray
                      counts={counts}
                      selection={selection}
                      onSelect={(id: TriageCellId) =>
                        setSelection({ kind: "cell", id })
                      }
                      panelId="triage-panel"
                      state={state}
                      onRetry={() => dashQuery.refetch()}
                    />
                  </section>
                  <div className="min-w-0 lg:col-span-5">
                    <TriagePanel
                      id="triage-panel"
                      selection={selection}
                      aggregates={aggregates}
                      data={data}
                      today={today}
                      query={query}
                      actions={actions}
                      state={state}
                      onRetry={() => dashQuery.refetch()}
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <StageBoard
                    recipients={aggregates.recipientStages}
                    donors={aggregates.donorStages}
                    selection={selection}
                    onSelectStage={(patientType, stage) =>
                      setSelection({ kind: "stage", patientType, stage })
                    }
                    panelId="triage-panel"
                    state={state}
                    onRetry={() => dashQuery.refetch()}
                    onEnroll={enroll}
                  />
                </div>
              </main>
            </PageTransition>
            <ServiceActionDialog
              action={action}
              onClose={() => setAction(null)}
            />
          </AdminShell>
        </div>
      </AdminToaster>
    </MotionRoot>
  );
}
