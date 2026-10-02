import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, FileText, MinusCircle } from "lucide-react";
import { useLocation } from "wouter";
import { ClayCard, ClayButton } from "@/components/clay";
import { PATIENT_TABS, PatientShell, type PatientTabId } from "@/components/ktp/patient";
import { PageTransition } from "@/components/motion";
import { trpc } from "@/lib/trpc";
import { dateKey } from "@shared/ktp";

const PHASE_TITLES: Record<string, string> = {
  Phase1: "Phase 1: General Workup",
  Phase2: "Phase 2: Cardiopulmonary & Infections",
  Clearances: "Clearances: Specialty Consultations",
  Phase3: "Phase 3: Final Pre-Transplant",
};

type PhaseFilter = "all" | number;

export default function PatientChecklistPage() {
  const [, navigate] = useLocation();
  const [activePhase, setActivePhase] = useState<PhaseFilter>("all");

  useEffect(() => {
    document.title = "Checklist | KTP";
  }, []);

  const clinicalQuery = trpc.patientPortal.getMyClinical.useQuery();
  const checklist = clinicalQuery.data?.checklist ?? [];

  const handleNav = (tabId: PatientTabId) => {
    if (tabId === "home") navigate("/me");
    else if (tabId === "labs") navigate("/me/labs");
    else if (tabId === "checklist") navigate("/me/checklist");
    else if (tabId === "calendar") navigate("/me/calendar");
    else if (tabId === "messages") navigate("/me/messages");
  };

  const applicableItems = checklist.filter((item) => item.status !== "NA");
  const doneItems = checklist.filter((item) => item.status === "Done");
  const percentComplete =
    applicableItems.length > 0
      ? Math.round((doneItems.length / applicableItems.length) * 100)
      : 0;

  // Group items by phase
  const phases = Array.from(
    new Set(checklist.map((item) => item.phase).filter((p): p is number => p !== null))
  ).sort((a, b) => a - b);

  const filteredItems =
    activePhase === "all"
      ? checklist
      : checklist.filter((item) => item.phase === activePhase);

  return (
    <PatientShell active="checklist" onNavigate={handleNav} tabs={PATIENT_TABS}>
      <PageTransition routeKey="patient-checklist" focusHeading={false}>
        <div className="flex flex-col gap-6">
          <header className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate("/me")}
              className="clay-focus rounded-full p-2 text-ink-muted hover:bg-surface-2"
              aria-label="Back to Home"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div>
              <h1 className="type-display text-ink">Workup Checklist</h1>
              <p className="type-body-sm text-ink-muted">Pre-transplant evaluation phases and clearances</p>
            </div>
          </header>

          {/* Progress Overview Card */}
          {!clinicalQuery.isLoading && checklist.length > 0 && (
            <ClayCard className="p-5">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="type-body font-medium text-ink">Overall Workup Progress</span>
                  <span className="font-mono text-lg font-bold text-ink">{percentComplete}%</span>
                </div>
                {/* Progress bar track */}
                <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-olive transition-all duration-500 ease-out"
                    style={{ width: `${percentComplete}%` }}
                  />
                </div>
                <div className="flex items-center justify-between type-body-sm text-ink-muted">
                  <span>
                    {doneItems.length} of {applicableItems.length} requirements completed
                  </span>
                  <span>{checklist.length - applicableItems.length} not applicable</span>
                </div>
              </div>
            </ClayCard>
          )}

          {/* Phase Filter Tabs */}
          {phases.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActivePhase("all")}
                className={`clay-focus rounded-full px-3 py-1 type-body-sm transition ${
                  activePhase === "all"
                    ? "bg-surface-1 font-medium text-ink shadow-sm"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                All Phases ({checklist.length})
              </button>
              {phases.map((phase) => {
                const phaseItems = checklist.filter((i) => i.phase === phase);
                const phaseDone = phaseItems.filter((i) => i.status === "Done").length;
                return (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => setActivePhase(phase)}
                    className={`clay-focus rounded-full px-3 py-1 type-body-sm transition ${
                      activePhase === phase
                        ? "bg-surface-1 font-medium text-ink shadow-sm"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    Phase {phase} ({phaseDone}/{phaseItems.length})
                  </button>
                );
              })}
            </div>
          )}

          {/* Loading State */}
          {clinicalQuery.isLoading && (
            <ClayCard className="p-8 text-center text-ink-muted">
              <p className="type-body">Loading checklist...</p>
            </ClayCard>
          )}

          {/* Error State */}
          {clinicalQuery.isError && (
            <ClayCard className="p-8 text-center text-ink">
              <p className="type-headline text-brick">Failed to load checklist</p>
              <p className="mt-2 type-body-sm text-ink-muted">Please check your connection and try again.</p>
              <div className="mt-4 flex justify-center">
                <ClayButton onClick={() => clinicalQuery.refetch()}>Retry</ClayButton>
              </div>
            </ClayCard>
          )}

          {/* Empty State */}
          {!clinicalQuery.isLoading && !clinicalQuery.isError && checklist.length === 0 && (
            <ClayCard className="p-8 text-center text-ink-muted">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-ink">
                <FileText className="size-6" />
              </div>
              <p className="mt-4 type-headline text-ink">No checklist items configured</p>
              <p className="mt-2 type-body-sm">
                Your pre-transplant workup steps and clearances will appear here once configured by the team.
              </p>
              <div className="mt-6 flex justify-center">
                <ClayButton variant="secondary" onClick={() => navigate("/me")}>
                  Back to Home
                </ClayButton>
              </div>
            </ClayCard>
          )}

          {/* Checklist Items */}
          {!clinicalQuery.isLoading && filteredItems.length > 0 && (
            <div className="flex flex-col gap-3">
              {filteredItems.map((item) => {
                const isDone = item.status === "Done";
                const isNA = item.status === "NA";

                return (
                  <ClayCard key={item.catalogId} className="p-4 sm:p-5">
                    <div className="flex items-start gap-3.5">
                      <div className="mt-0.5 shrink-0">
                        {isDone && <CheckCircle2 className="size-5 text-olive" />}
                        {isNA && <MinusCircle className="size-5 text-ink-muted/50" />}
                        {!isDone && !isNA && <Circle className="size-5 text-ink-muted/60" />}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-ink-muted">
                            [{item.category}]
                          </span>
                          <h2
                            className={`type-body font-medium break-words ${
                              isDone ? "text-ink" : isNA ? "text-ink-muted line-through" : "text-ink"
                            }`}
                          >
                            {item.name}
                          </h2>
                          {item.asIndicated && (
                            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-muted">
                              As Indicated
                            </span>
                          )}
                        </div>

                        {item.doneDate && (
                          <p className="type-caption text-olive font-medium">
                            Completed on {dateKey(item.doneDate)}
                          </p>
                        )}

                        {item.note && (
                          <p className="mt-1 type-body-sm text-ink-muted break-words">
                            Note: {item.note}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0">
                        {isDone && (
                          <span className="rounded-full bg-olive-tint px-2.5 py-0.5 type-caption font-medium text-olive">
                            Done
                          </span>
                        )}
                        {isNA && (
                          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 type-caption text-ink-muted">
                            N/A
                          </span>
                        )}
                        {!isDone && !isNA && (
                          <span className="rounded-full border border-dashed border-ink-muted/40 px-2.5 py-0.5 type-caption text-ink-muted">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  </ClayCard>
                );
              })}
            </div>
          )}
        </div>
      </PageTransition>
    </PatientShell>
  );
}
