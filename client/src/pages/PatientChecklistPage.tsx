import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, FileText, MinusCircle } from "lucide-react";
import { useLocation } from "wouter";
import { ClayCard, ClayButton } from "@/components/clay";
import { PATIENT_TABS, PatientShell, type PatientTabId } from "@/components/ktp/patient";
import { PageTransition } from "@/components/motion";
import { trpc } from "@/lib/trpc";
import { dateKey } from "@shared/ktp";

type PhaseFilter = "all" | number;
type CategoryFilter = "all" | "Lab" | "Imaging" | "Clearance" | "Milestone";

export default function PatientChecklistPage() {
  const [, navigate] = useLocation();
  const [activePhase, setActivePhase] = useState<PhaseFilter>("all");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

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

  // Distinct phases sorted numerically
  const phases = Array.from(
    new Set(checklist.map((item) => item.phase).filter((p): p is number => p !== null))
  ).sort((a, b) => a - b);

  // Filter items by phase and category
  const filteredItems = checklist.filter((item) => {
    if (activePhase !== "all" && item.phase !== activePhase) return false;
    if (activeCategory !== "all" && item.category !== activeCategory) return false;
    return true;
  });

  return (
    <PatientShell active="checklist" onNavigate={handleNav} tabs={PATIENT_TABS}>
      <PageTransition routeKey="patient-checklist" focusHeading={false}>
        <div className="flex flex-col gap-4">
          {/* Compact Top Header with Integrated Progress */}
          <header className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => navigate("/me")}
                className="clay-focus rounded-full p-1.5 text-ink-muted hover:bg-surface-2"
                aria-label="Back to Home"
              >
                <ArrowLeft className="size-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  Workup Checklist
                </h1>
                <p className="type-caption text-ink-muted">
                  Pre-transplant evaluation requirements and clearances
                </p>
              </div>
            </div>

            {/* Inline Mini Progress Bar */}
            {!clinicalQuery.isLoading && checklist.length > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-1 px-3.5 py-1.5 shadow-xs">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                    <span>
                      Done: <strong className="text-ink">{doneItems.length}</strong>/{applicableItems.length}
                    </span>
                    <span className="font-mono font-bold text-ink">{percentComplete}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-surface-2 sm:w-40">
                    <div
                      className="h-full rounded-full bg-olive transition-all duration-300"
                      style={{ width: `${percentComplete}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </header>

          {/* Phase and Category Filter Toolbar */}
          {checklist.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-2.5">
              {/* Phase Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActivePhase("all")}
                  className={`clay-focus rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    activePhase === "all"
                      ? "bg-surface-1 text-ink shadow-xs"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  All ({checklist.length})
                </button>
                {phases.map((phase) => {
                  const phaseItems = checklist.filter((i) => i.phase === phase);
                  const phaseDone = phaseItems.filter((i) => i.status === "Done").length;
                  return (
                    <button
                      key={phase}
                      type="button"
                      onClick={() => setActivePhase(phase)}
                      className={`clay-focus rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        activePhase === phase
                          ? "bg-surface-1 text-ink shadow-xs"
                          : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      Phase {phase} ({phaseDone}/{phaseItems.length})
                    </button>
                  );
                })}
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1">
                {(["all", "Lab", "Imaging", "Clearance"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`clay-focus rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                      activeCategory === cat
                        ? "bg-olive-tint text-olive"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {cat === "all" ? "All types" : cat}
                  </button>
                ))}
              </div>
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
            <ClayCard className="p-6 text-center text-ink">
              <p className="type-headline text-brick">Failed to load checklist</p>
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
              <div className="mt-6 flex justify-center">
                <ClayButton variant="secondary" onClick={() => navigate("/me")}>
                  Back to Home
                </ClayButton>
              </div>
            </ClayCard>
          )}

          {/* Compact Multi-Column Grid - Fits in One Screen */}
          {!clinicalQuery.isLoading && filteredItems.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => {
                const isDone = item.status === "Done";
                const isNA = item.status === "NA";

                return (
                  <ClayCard
                    key={item.catalogId}
                    level={1}
                    padding="none"
                    className={`flex items-center justify-between gap-2 rounded-lg border border-hairline px-3 py-2 transition hover:bg-surface-2 ${
                      isDone ? "bg-olive-tint/20" : isNA ? "bg-surface-2/40 opacity-70" : "bg-surface-1"
                    }`}
                  >
                    {/* Left: Icon + Tag + Name */}
                    <div className="flex min-w-0 items-center gap-2">
                      {isDone && <CheckCircle2 className="size-4 shrink-0 text-olive" />}
                      {isNA && <MinusCircle className="size-4 shrink-0 text-ink-muted/50" />}
                      {!isDone && !isNA && <Circle className="size-4 shrink-0 text-ink-muted/50" />}

                      <span className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[10px] text-ink-muted shrink-0">
                        {item.category === "Clearance" ? "Clr" : item.category}
                      </span>

                      <span
                        className={`truncate text-xs font-medium ${
                          isDone ? "text-ink" : isNA ? "line-through text-ink-muted" : "text-ink"
                        }`}
                        title={item.name}
                      >
                        {item.name}
                      </span>
                    </div>

                    {/* Right: Status Pill */}
                    <div className="shrink-0">
                      {isDone && (
                        <span
                          className="rounded-full bg-olive-tint px-2 py-0.5 text-[10px] font-medium text-olive"
                          title={item.doneDate ? `Done on ${dateKey(item.doneDate)}` : "Done"}
                        >
                          Done
                        </span>
                      )}
                      {isNA && (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-ink-muted">
                          N/A
                        </span>
                      )}
                      {!isDone && !isNA && (
                        <span className="rounded-full border border-dashed border-ink-muted/40 px-2 py-0.5 text-[10px] text-ink-muted">
                          Pending
                        </span>
                      )}
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
