import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { ClayCard, ClayButton } from "@/components/clay";
import { PATIENT_TABS, PatientShell, type PatientTabId } from "@/components/ktp/patient";
import { PageTransition } from "@/components/motion";

export default function PatientCalendarPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    document.title = "Calendar | KTP";
  }, []);

  const handleNav = (tabId: PatientTabId) => {
    if (tabId === "home") navigate("/me");
    else if (tabId === "labs") navigate("/me/labs");
    else if (tabId === "checklist") navigate("/me/checklist");
    else if (tabId === "calendar") navigate("/me/calendar");
    else if (tabId === "messages") navigate("/me/messages");
  };

  return (
    <PatientShell active="calendar" onNavigate={handleNav} tabs={PATIENT_TABS}>
      <PageTransition routeKey="patient-calendar" focusHeading={false}>
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
              <h1 className="type-display text-ink">Appointments</h1>
              <p className="type-body-sm text-ink-muted">Clinic schedule and confirmation</p>
            </div>
          </header>

          <ClayCard className="p-8 text-center text-ink-muted">
            <p className="type-headline text-ink">Appointment scheduling connects in Phase A3</p>
            <p className="mt-2 type-body-sm">
              Your clinic appointments and follow-up visits will appear here with one-tap confirmation and reschedule requests.
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
