import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { ClayCard, ClayButton } from "@/components/clay";
import { EmergencyBand, PATIENT_TABS, PatientShell, type PatientTabId } from "@/components/ktp/patient";
import { PageTransition } from "@/components/motion";
import { trpc } from "@/lib/trpc";

export default function PatientMessagesPage() {
  const [, navigate] = useLocation();
  const settingsQuery = trpc.settings.getAll.useQuery();
  const hotline = settingsQuery.data?.emergencyHotlineText ?? "KT Unit Hotline: 0917-000-0000";

  useEffect(() => {
    document.title = "Messages | KTP";
  }, []);

  const handleNav = (tabId: PatientTabId) => {
    if (tabId === "home") navigate("/me");
    else if (tabId === "labs") navigate("/me/labs");
    else if (tabId === "checklist") navigate("/me/checklist");
    else if (tabId === "calendar") navigate("/me/calendar");
    else if (tabId === "messages") navigate("/me/messages");
  };

  return (
    <PatientShell active="messages" onNavigate={handleNav} tabs={PATIENT_TABS}>
      <PageTransition routeKey="patient-messages" focusHeading={false}>
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
              <h1 className="type-display text-ink">Messages</h1>
              <p className="type-body-sm text-ink-muted">Notices and instructions from your care team</p>
            </div>
          </header>

          <EmergencyBand hotlineText={hotline} hotlineTel="0917000000" />

          <ClayCard className="p-8 text-center text-ink-muted">
            <p className="type-headline text-ink">Broadcast messages connect in Phase A3</p>
            <p className="mt-2 type-body-sm">
              Official one-way announcements and care instructions sent to you by the KT unit will appear here with read and acknowledgment tracking.
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
