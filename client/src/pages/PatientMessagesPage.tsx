import { useEffect } from "react";
import { ArrowLeft, CheckCircle2, MessageSquare } from "lucide-react";
import { useLocation } from "wouter";
import { ClayCard, ClayButton } from "@/components/clay";
import {
  EmergencyBand,
  PATIENT_TABS,
  PatientShell,
  PatientToastRegion,
  usePatientToast,
  type PatientTabId,
} from "@/components/ktp/patient";
import { PageTransition } from "@/components/motion";
import { trpc } from "@/lib/trpc";

export default function PatientMessagesPage() {
  const [, navigate] = useLocation();
  const { toast, show, dismiss } = usePatientToast();
  const settingsQuery = trpc.settings.getAll.useQuery();
  const hotline = settingsQuery.data?.emergencyHotlineText ?? "KT Unit Hotline: 0917-000-0000";

  useEffect(() => {
    document.title = "Messages | KTP";
  }, []);

  const utils = trpc.useUtils();
  const messagesQuery = trpc.patientPortal.getMyMessages.useQuery();
  const messages = messagesQuery.data ?? [];

  const unreadCount = messages.filter((m) => !m.acknowledgedAt).length;

  const ackMutation = trpc.patientPortal.acknowledgeMessage.useMutation({
    onSuccess: () => {
      utils.patientPortal.getMyMessages.invalidate();
      show({
        title: "Message acknowledged",
        body: "Your acknowledgment has been recorded for the care team.",
        tone: "info",
      });
    },
    onError: (err) => {
      show({
        title: "Acknowledgment failed",
        body: err.message || "Could not record acknowledgment.",
        tone: "info",
      });
    },
  });

  const handleNav = (tabId: PatientTabId) => {
    if (tabId === "home") navigate("/me");
    else if (tabId === "labs") navigate("/me/labs");
    else if (tabId === "checklist") navigate("/me/checklist");
    else if (tabId === "calendar") navigate("/me/calendar");
    else if (tabId === "messages") navigate("/me/messages");
  };

  const handleAcknowledge = (messageId: number) => {
    ackMutation.mutate({ messageId });
  };

  return (
    <PatientShell
      active="messages"
      onNavigate={handleNav}
      unread={unreadCount}
      tabs={PATIENT_TABS}
      overlay={<PatientToastRegion toast={toast} onDismiss={dismiss} />}
    >
      <PageTransition routeKey="patient-messages" focusHeading={false}>
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
              <h1 className="type-display text-ink">Messages</h1>
              <p className="type-body-sm text-ink-muted">Notices and instructions from your care team</p>
            </div>
          </header>

          <EmergencyBand hotlineText={hotline} hotlineTel="0917000000" />

          {/* Loading State */}
          {messagesQuery.isLoading && (
            <ClayCard className="p-8 text-center text-ink-muted">
              <p className="type-body">Loading messages...</p>
            </ClayCard>
          )}

          {/* Error State */}
          {messagesQuery.isError && (
            <ClayCard className="p-8 text-center text-ink">
              <p className="type-headline text-brick">Failed to load messages</p>
              <p className="mt-2 type-body-sm text-ink-muted">Please check your connection and try again.</p>
              <div className="mt-4 flex justify-center">
                <ClayButton onClick={() => messagesQuery.refetch()}>Retry</ClayButton>
              </div>
            </ClayCard>
          )}

          {/* Empty State */}
          {!messagesQuery.isLoading && !messagesQuery.isError && messages.length === 0 && (
            <ClayCard className="p-8 text-center text-ink-muted">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-ink">
                <MessageSquare className="size-6" />
              </div>
              <p className="mt-4 type-headline text-ink">No broadcast messages yet</p>
              <p className="mt-2 type-body-sm">
                Official announcements and care instructions from the transplant unit will appear here.
              </p>
              <div className="mt-6 flex justify-center">
                <ClayButton variant="secondary" onClick={() => navigate("/me")}>
                  Back to Home
                </ClayButton>
              </div>
            </ClayCard>
          )}

          {/* Messages List */}
          {!messagesQuery.isLoading && messages.length > 0 && (
            <div className="flex flex-col gap-4">
              {messages.map((msg) => {
                const isAcknowledged = Boolean(msg.acknowledgedAt);
                const dateStr = new Date(msg.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                });

                return (
                  <ClayCard
                    key={msg.id}
                    className={`p-5 transition ${
                      !isAcknowledged ? "border-l-4 border-l-olive bg-surface-1" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h2 className="type-headline text-ink">{msg.subject}</h2>
                          <p className="type-caption text-ink-muted">Sent on {dateStr}</p>
                        </div>

                        <div>
                          {isAcknowledged ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-olive-tint px-3 py-0.5 type-caption font-medium text-olive">
                              <CheckCircle2 className="size-3.5" /> Acknowledged
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-surface-2 px-3 py-0.5 type-caption font-medium text-ink">
                              Unread
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="whitespace-pre-line rounded-xl bg-surface-2/40 p-4 type-body text-ink">
                        {msg.body}
                      </div>

                      {!isAcknowledged && (
                        <div className="flex justify-end pt-2">
                          <ClayButton
                            onClick={() => handleAcknowledge(msg.id)}
                            disabled={ackMutation.isPending}
                          >
                            Acknowledge Receipt
                          </ClayButton>
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
