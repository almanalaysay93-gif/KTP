import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { ClayCard, ClayButton } from "@/components/clay";
import { PATIENT_TABS, PatientShell, type PatientTabId } from "@/components/ktp/patient";
import { PageTransition } from "@/components/motion";

export default function PatientChecklistPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    document.title = "Checklist | KTP";
  }, []);

  const handleNav = (tabId: PatientTabId) => {
    if (tabId === "home") navigate("/me");
    else if (tabId === "labs") navigate("/me/labs");
    else if (tabId === "checklist") navigate("/me/checklist");
    else if (tabId === "calendar") navigate("/me/calendar");
    else if (tabId === "messages") navigate("/me/messages");
  };

  return (
    <PatientShell active="checklist" onNavigate={handleNav} tabs={PATIENT_TABS}>
      <PageTransition routeKey="patient-checklist" focusHeading={false}>
        <div className="flex flex-col gap-6">
          <header className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate("/me")}
              className="clay-focus rounded-full p-2 text-ink-muted hover:bg-surface-2"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div>
              <h1 className="type-display text-ink">Workup Checklist</h1>
              <p className="type-body-sm text-ink-muted">Pre-transplant evaluation phases and clearances</p>
            </div>
          </header>

          <ClayCard className="p-8 text-center text-ink-muted">
            <p className="type-headline text-ink">Workup checklist connects in Phase A3</p>
            <p className="mt-2 type-body-sm">
              Your Phase 1 to Phase 3 labs, imaging tests, and specialty clearances will display your completion status here.
            </p>
            <div className="mt-6 flex justify-center">
              <ClayButton variant="secondary" onClick={() => navigate("/me")}>
                Back to Home
              </ClayButton>
            </div>
          </ClayCard>
        </div>
      </PageTransition>
    </PatientShell>
  );
}
