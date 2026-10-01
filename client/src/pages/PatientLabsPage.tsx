import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { ClayCard, ClayButton } from "@/components/clay";
import { PATIENT_TABS, PatientShell, type PatientTabId } from "@/components/ktp/patient";
import { PageTransition } from "@/components/motion";

export default function PatientLabsPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    document.title = "Labs | KTP";
  }, []);

  const handleNav = (tabId: PatientTabId) => {
    if (tabId === "home") navigate("/me");
    else if (tabId === "labs") navigate("/me/labs");
    else if (tabId === "checklist") navigate("/me/checklist");
    else if (tabId === "calendar") navigate("/me/calendar");
    else if (tabId === "messages") navigate("/me/messages");
  };

  return (
    <PatientShell active="labs" onNavigate={handleNav} tabs={PATIENT_TABS}>
      <PageTransition routeKey="patient-labs" focusHeading={false}>
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
              <h1 className="type-display text-ink">Lab Results</h1>
              <p className="type-body-sm text-ink-muted">Blood chemistry, tacrolimus levels, and trends</p>
            </div>
          </header>

          <ClayCard className="p-8 text-center text-ink-muted">
            <p className="type-headline text-ink">Lab tracking connects in Phase A3</p>
            <p className="mt-2 type-body-sm">
              Your medical laboratory values, longitudinal trend charts, and reference flags will appear here as results are uploaded by the KT unit.
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
