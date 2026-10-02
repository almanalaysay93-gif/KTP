import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, CalendarDays, CheckCircle2, Clock, MapPin } from "lucide-react";
import { useLocation } from "wouter";
import { ClayCard, ClayButton, ClayInput } from "@/components/clay";
import {
  PATIENT_TABS,
  PatientShell,
  PatientToastRegion,
  usePatientToast,
  type PatientTabId,
} from "@/components/ktp/patient";
import { PageTransition } from "@/components/motion";
import { trpc } from "@/lib/trpc";

export default function PatientCalendarPage() {
  const [, navigate] = useLocation();
  const { toast, show, dismiss } = usePatientToast();
  const [rescheduleModalId, setRescheduleModalId] = useState<number | null>(null);
  const [rescheduleNote, setRescheduleNote] = useState("");

  useEffect(() => {
    document.title = "Calendar | KTP";
  }, []);

  const utils = trpc.useUtils();
  const clinicalQuery = trpc.patientPortal.getMyClinical.useQuery();
  const appointments = clinicalQuery.data?.appointments ?? [];

  const respondMutation = trpc.patientPortal.respondAppointment.useMutation({
    onSuccess: (_, variables) => {
      utils.patientPortal.getMyClinical.invalidate();
      setRescheduleModalId(null);
      setRescheduleNote("");
      if (variables.response === "Confirmed") {
        show({
          title: "Appointment confirmed",
          body: "Your confirmation has been sent to the clinic team.",
          tone: "info",
        });
      } else {
        show({
          title: "Reschedule requested",
          body: "The clinic staff will review your request and contact you.",
          tone: "info",
        });
      }
    },
    onError: (err) => {
      show({
        title: "Action failed",
        body: err.message || "Could not record response. Please try again.",
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

  const handleConfirm = (appointmentId: number) => {
    respondMutation.mutate({
      appointmentId,
      response: "Confirmed",
    });
  };

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleModalId) return;
    respondMutation.mutate({
      appointmentId: rescheduleModalId,
      response: "RescheduleRequested",
      responseNote: rescheduleNote.trim() || undefined,
    });
  };

  return (
    <PatientShell
      active="calendar"
      onNavigate={handleNav}
      tabs={PATIENT_TABS}
      overlay={<PatientToastRegion toast={toast} onDismiss={dismiss} />}
    >
      <PageTransition routeKey="patient-calendar" focusHeading={false}>
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
              <h1 className="type-display text-ink">Appointments</h1>
              <p className="type-body-sm text-ink-muted">Clinic schedule and confirmation</p>
            </div>
          </header>

          {/* Loading State */}
          {clinicalQuery.isLoading && (
            <ClayCard className="p-8 text-center text-ink-muted">
              <p className="type-body">Loading appointments...</p>
            </ClayCard>
          )}

          {/* Error State */}
          {clinicalQuery.isError && (
            <ClayCard className="p-8 text-center text-ink">
              <p className="type-headline text-brick">Failed to load schedule</p>
              <p className="mt-2 type-body-sm text-ink-muted">Please check your connection and try again.</p>
              <div className="mt-4 flex justify-center">
                <ClayButton onClick={() => clinicalQuery.refetch()}>Retry</ClayButton>
              </div>
            </ClayCard>
          )}

          {/* Empty State */}
          {!clinicalQuery.isLoading && !clinicalQuery.isError && appointments.length === 0 && (
            <ClayCard className="p-8 text-center text-ink-muted">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-ink">
                <CalendarDays className="size-6" />
              </div>
              <p className="mt-4 type-headline text-ink">No appointments scheduled</p>
              <p className="mt-2 type-body-sm">
                Your clinic visits and doctor appointments will appear here when scheduled by the transplant coordinator.
              </p>
              <div className="mt-6 flex justify-center">
                <ClayButton variant="secondary" onClick={() => navigate("/me")}>
                  Back to Home
                </ClayButton>
              </div>
            </ClayCard>
          )}

          {/* Appointments List */}
          {!clinicalQuery.isLoading && appointments.length > 0 && (
            <div className="flex flex-col gap-4">
              {appointments.map((appt) => {
                const startDate = new Date(appt.startsAt);
                const isUpcoming = startDate.getTime() >= Date.now() - 24 * 60 * 60 * 1000;
                const formattedDate = startDate.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const formattedTime = startDate.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                });

                return (
                  <ClayCard key={appt.id} className="p-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-surface-2 px-2.5 py-0.5 font-mono text-xs font-medium text-ink">
                              {appt.kind}
                            </span>
                            <h2 className="type-headline text-ink">{appt.title}</h2>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-4 type-body-sm text-ink-muted">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="size-4" />
                              {formattedDate}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="size-4" />
                              {formattedTime}
                            </span>
                            {appt.location && (
                              <span className="flex items-center gap-1.5">
                                <MapPin className="size-4" />
                                {appt.location}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Chip */}
                        <div>
                          {appt.response === "Confirmed" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-olive-tint px-3 py-1 font-medium text-olive type-body-sm">
                              <CheckCircle2 className="size-4" /> Confirmed
                            </span>
                          )}
                          {appt.response === "RescheduleRequested" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 font-medium text-ink type-body-sm">
                              Reschedule Requested
                            </span>
                          )}
                          {(!appt.response || appt.response === "Pending") && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink-muted/40 px-3 py-1 font-medium text-ink-muted type-body-sm">
                              Pending Response
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Doctor Notes */}
                      {appt.note && (
                        <div className="rounded-xl bg-surface-2/60 p-3 type-body-sm text-ink-muted">
                          <strong className="text-ink">Instructions:</strong> {appt.note}
                        </div>
                      )}

                      {/* Reschedule Note Display */}
                      {appt.response === "RescheduleRequested" && appt.responseNote && (
                        <div className="rounded-xl bg-surface-2/40 p-3 type-body-sm text-ink-muted">
                          <strong className="text-ink">Your Note:</strong> {appt.responseNote}
                        </div>
                      )}

                      {/* Response Action Buttons for Pending Appointments */}
                      {(!appt.response || appt.response === "Pending") && isUpcoming && (
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          <ClayButton
                            onClick={() => handleConfirm(appt.id)}
                            disabled={respondMutation.isPending}
                          >
                            Confirm Appointment
                          </ClayButton>
                          <ClayButton
                            variant="secondary"
                            onClick={() => {
                              setRescheduleModalId(appt.id);
                              setRescheduleNote("");
                            }}
                            disabled={respondMutation.isPending}
                          >
                            Request Reschedule
                          </ClayButton>
                        </div>
                      )}

                      {/* Inline Reschedule Note Form */}
                      {rescheduleModalId === appt.id && (
                        <form
                          onSubmit={handleRescheduleSubmit}
                          className="mt-3 flex flex-col gap-3 rounded-2xl bg-surface-2 p-4"
                        >
                          <ClayInput
                            label="Reason or preferred schedule (optional)"
                            value={rescheduleNote}
                            onChange={(e) => setRescheduleNote(e.target.value)}
                            placeholder="e.g. Cannot make it at 9 AM, prefer afternoon or next Monday"
                            maxLength={500}
                          />
                          <div className="flex items-center gap-2">
                            <ClayButton type="submit" disabled={respondMutation.isPending}>
                              Send Request
                            </ClayButton>
                            <ClayButton
                              variant="ghost"
                              type="button"
                              onClick={() => setRescheduleModalId(null)}
                            >
                              Cancel
                            </ClayButton>
                          </div>
                        </form>
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
