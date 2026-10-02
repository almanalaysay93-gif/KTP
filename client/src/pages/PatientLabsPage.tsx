import { useEffect, useState } from "react";
import { ArrowLeft, Filter, FlaskConical } from "lucide-react";
import { useLocation } from "wouter";
import { ClayCard, ClayButton, StatusChip } from "@/components/clay";
import { PATIENT_TABS, PatientShell, type PatientTabId } from "@/components/ktp/patient";
import { PatientLabUploadCard } from "@/components/ktp/patient/PatientLabUploadCard";
import { PageTransition } from "@/components/motion";
import { trpc } from "@/lib/trpc";
import { dateKey } from "@shared/ktp";

export default function PatientLabsPage() {
  const [, navigate] = useLocation();
  const [selectedTest, setSelectedTest] = useState<string>("all");

  useEffect(() => {
    document.title = "Labs | KTP";
  }, []);

  const clinicalQuery = trpc.patientPortal.getMyClinical.useQuery();
  const labResults = clinicalQuery.data?.labResults ?? [];

  const handleNav = (tabId: PatientTabId) => {
    if (tabId === "home") navigate("/me");
    else if (tabId === "labs") navigate("/me/labs");
    else if (tabId === "checklist") navigate("/me/checklist");
    else if (tabId === "calendar") navigate("/me/calendar");
    else if (tabId === "messages") navigate("/me/messages");
  };

  const testNames = Array.from(new Set(labResults.map((r) => r.testName)));
  const filteredResults =
    selectedTest === "all"
      ? labResults
      : labResults.filter((r) => r.testName === selectedTest);

  return (
    <PatientShell active="labs" onNavigate={handleNav} tabs={PATIENT_TABS}>
      <PageTransition routeKey="patient-labs" focusHeading={false}>
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
              <h1 className="type-display text-ink">Lab Results</h1>
              <p className="type-body-sm text-ink-muted">Blood chemistry, tacrolimus levels, and trends</p>
            </div>
          </header>

          <PatientLabUploadCard onSuccess={() => clinicalQuery.refetch()} />

          {/* Test Filter */}
          {testNames.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 type-caption text-ink-muted">
                <Filter className="size-3.5" /> Filter:
              </span>
              <button
                type="button"
                onClick={() => setSelectedTest("all")}
                className={`clay-focus rounded-full px-3 py-1 type-body-sm transition ${
                  selectedTest === "all"
                    ? "bg-surface-1 font-medium text-ink shadow-sm"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                All tests ({labResults.length})
              </button>
              {testNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedTest(name)}
                  className={`clay-focus rounded-full px-3 py-1 type-body-sm transition ${
                    selectedTest === name
                      ? "bg-surface-1 font-medium text-ink shadow-sm"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* Loading State */}
          {clinicalQuery.isLoading && (
            <ClayCard className="p-8 text-center text-ink-muted">
              <p className="type-body">Loading lab results...</p>
            </ClayCard>
          )}

          {/* Error State */}
          {clinicalQuery.isError && (
            <ClayCard className="p-8 text-center text-ink">
              <p className="type-headline text-brick">Failed to load lab results</p>
              <p className="mt-2 type-body-sm text-ink-muted">Please check your connection and try again.</p>
              <div className="mt-4 flex justify-center">
                <ClayButton onClick={() => clinicalQuery.refetch()}>Retry</ClayButton>
              </div>
            </ClayCard>
          )}

          {/* Empty State */}
          {!clinicalQuery.isLoading && !clinicalQuery.isError && labResults.length === 0 && (
            <ClayCard className="p-8 text-center text-ink-muted">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-olive-tint text-olive">
                <FlaskConical className="size-6" />
              </div>
              <p className="mt-4 type-headline text-ink">No lab results on file yet</p>
              <p className="mt-2 type-body-sm">
                Your medical laboratory values and reference ranges will appear here as results are uploaded by the transplant team.
              </p>
              <div className="mt-6 flex justify-center">
                <ClayButton variant="secondary" onClick={() => navigate("/me")}>
                  Back to Home
                </ClayButton>
              </div>
            </ClayCard>
          )}

          {/* Lab Results List - Compact Multi-Column Grid */}
          {!clinicalQuery.isLoading && filteredResults.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredResults.map((result) => {
                const flagStatus =
                  result.flag === "High"
                    ? "lab-high"
                    : result.flag === "Low"
                      ? "lab-low"
                      : "lab-normal";

                const dateStr = result.serviceDate
                  ? dateKey(result.serviceDate)
                  : "Date not recorded";

                return (
                  <ClayCard key={result.id} className="p-3.5">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-1.5">
                        <h2 className="text-sm font-semibold text-ink truncate" title={result.testName}>
                          {result.testName}
                        </h2>
                        {result.flag && (
                          <StatusChip status={flagStatus} label={result.flag} size="patient" />
                        )}
                      </div>

                      <div className="flex items-baseline justify-between pt-1">
                        <div className="flex items-baseline gap-1">
                          <span className="font-mono text-xl font-bold text-ink">{result.value}</span>
                          <span className="text-xs text-ink-muted">{result.unit}</span>
                        </div>
                        <span className="text-[11px] text-ink-muted">{dateStr}</span>
                      </div>

                      {(result.lowSnapshot !== null || result.highSnapshot !== null) && (
                        <div className="border-t border-hairline pt-1 text-[11px] text-ink-muted truncate">
                          Ref: {result.lowSnapshot ?? "0"} - {result.highSnapshot ?? "max"} {result.unit}
                        </div>
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
