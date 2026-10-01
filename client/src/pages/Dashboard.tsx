import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useLocation } from "wouter";
import {
  AdminShell,
  AdminToaster,
  BellButton,
  SearchField,
  ServiceActionDialog,
  StageBoard,
  TriagePanel,
  TriageTray,
  fmtLongDate,
  useAdminToast,
  type RowActions,
  type ServiceAction,
  type TriageCellId,
  type TriageSelection,
} from "@/components/ktp/admin";
import { MotionClayButton, MotionRoot, OrganGridBackdrop, PageTransition } from "@/components/motion";
import { trpc } from "@/lib/trpc";
import { todayDate } from "@shared/ktp";

const ADMIN_HREFS = {
  dashboard: "/dashboard",
  patients: "/patients",
  calendar: "/calendar",
  messages: "/messages",
  settings: "/settings",
} as const;

export default function Dashboard() {
  const toast = useAdminToast();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<TriageSelection>({ kind: "cell", id: "overdue" });
  const [action, setAction] = useState<ServiceAction | null>(null);

  const dashQuery = trpc.dashboard.initial.useQuery();
  const patientsQuery = trpc.patients.list.useQuery();

  const today = dashQuery.data?.today ?? todayDate();

  useEffect(() => {
    document.title = "Dashboard | KTP";
  }, []);

  const rawRecipientStages = (dashQuery.data?.recipientStages ?? {}) as Record<string, number>
  const rawDonorStages = (dashQuery.data?.donorStages ?? {}) as Record<string, number>

  const recipientStageCounts = useMemo(() => {
    const stages = ["Orientation", "Phase1", "Phase2", "Clearances", "PhilHealthZ", "Phase3", "PostKT"] as const
    return stages.map((stage) => ({
      stage,
      label: stage === "PostKT" ? "Post-KT" : stage,
      count: rawRecipientStages[stage] ?? 0,
    }))
  }, [rawRecipientStages])

  const donorStageCounts = useMemo(() => {
    const stages = ["Orientation", "Phase1", "Phase2", "Clearances", "Phase3", "PostDonation"] as const
    return stages.map((stage) => ({
      stage,
      label: stage === "PostDonation" ? "Post-donation" : stage,
      count: rawDonorStages[stage] ?? 0,
    }))
  }, [rawDonorStages])

  const aggregates = useMemo(() => {
    const d = dashQuery.data
    const pts = patientsQuery.data ?? []
    const totalPatients = d?.totalPatients ?? pts.length
    const superseded = (d?.supersededUnfiledClaims ?? []) as any[]
    return {
      totalPatients,
      activeCount: totalPatients,
      recipientCount: d?.recipientCount ?? pts.filter((p) => p.patientType === "Recipient").length,
      donorCount: d?.donorCount ?? pts.filter((p) => p.patientType === "Donor").length,
      recipientStages: recipientStageCounts,
      donorStages: donorStageCounts,
      overdueServices: (d?.overdueServices ?? []) as any[],
      claimsDueSoon: (d?.claimsDueSoon ?? []) as any[],
      rescheduleRequests: (d?.rescheduleRequests ?? []) as any[],
      supersededUnfiledClaims: superseded,
      supersededUnfiled: superseded,
      patientsByStage: pts as any[],
    }
  }, [dashQuery.data, patientsQuery.data, recipientStageCounts, donorStageCounts])

  const counts = useMemo(() => {
    return {
      overdue: aggregates.overdueServices.length,
      claims: aggregates.claimsDueSoon.length,
      reschedule: aggregates.rescheduleRequests.length,
      superseded: aggregates.supersededUnfiled.length,
      active: aggregates.totalPatients,
      dueSoon: 0,
      workup: aggregates.recipientCount,
      postkt: rawRecipientStages["PostKT"] ?? 0,
      donors: aggregates.donorCount,
      recipients: aggregates.recipientCount,
      oldestOverdue: null,
      nextClaimDeadline: null,
      oldestReschedule: null,
      nextSupersededDeadline: null,
      nextDueSoon: null,
      workupStages: 0,
      newestPostKtDay: null,
      donorsWorkup: aggregates.donorCount,
      donorsPost: rawDonorStages["PostDonation"] ?? 0,
    }
  }, [aggregates, rawRecipientStages, rawDonorStages])

  const actions: RowActions = {
    onOpenPatient: (patient) => {
      navigate(`/patients/${patient.id}`);
    },
    onMarkFiled: (patient, record) => setAction({ kind: "claim", patient, record }),
    onSetNewTime: (row) => setAction({ kind: "reschedule", patient: row.patient, appointment: row.appointment }),
  };

  const bellCount = aggregates.rescheduleRequests.length;
  const enroll = () => navigate("/patients/new");

  return (
    <MotionRoot intensity="full">
      <AdminToaster>
        <div data-surface="admin" className="relative isolate min-h-dvh bg-ground text-ink">
          <OrganGridBackdrop />
          <AdminShell
            current="dashboard"
            hrefs={ADMIN_HREFS}
            mobileTitle="Dashboard"
            skipTo="triage"
            skipLabel="Skip to triage"
            mobileActions={
              <>
                <BellButton count={bellCount} onClick={() => navigate("/messages")} />
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
                    <p className="type-body-sm text-ink-muted">{fmtLongDate(today)}</p>
                    <h1 className="type-display text-ink">Dashboard</h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <SearchField value={query} onChange={setQuery} className="min-w-0 flex-1 lg:w-72 lg:flex-none" />
                    <BellButton count={bellCount} onClick={() => navigate("/messages")} className="max-lg:hidden" />
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
                      state={dashQuery.isLoading ? "loading" : "ready"}
                      onRetry={() => dashQuery.refetch()}
                    />
                  </section>
                  <div className="min-w-0 lg:col-span-5">
                    <TriagePanel
                      id="triage-panel"
                      selection={selection}
                      aggregates={aggregates}
                      query={query}
                      actions={actions}
                      state={dashQuery.isLoading ? "loading" : "ready"}
                      onRetry={() => dashQuery.refetch()}
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <StageBoard
                    recipients={recipientStageCounts}
                    donors={donorStageCounts}
                    selection={selection}
                    onSelectStage={(patientType, stage) => setSelection({ kind: "stage", patientType, stage })}
                    panelId="triage-panel"
                    state={dashQuery.isLoading ? "loading" : "ready"}
                    onRetry={() => dashQuery.refetch()}
                    onEnroll={enroll}
                  />
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
