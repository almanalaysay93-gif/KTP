import { useEffect, useState } from "react";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Filter,
  MapPin,
  Search,
  User,
} from "lucide-react";
import { Link } from "wouter";
import {
  AdminShell,
  AdminToaster,
} from "@/components/ktp/admin";
import { ClayButton, ClayCard, ClayInput } from "@/components/clay";
import {
  MotionRoot,
  OrganGridBackdrop,
  PageTransition,
} from "@/components/motion";
import { ADMIN_HREFS } from "@/lib/ktpAdminRoutes";
import { trpc } from "@/lib/trpc";
import { dateKey, todayDate } from "@shared/ktp";

type DateRangeFilter = "upcoming" | "today" | "week" | "all" | "past";

export default function AdminCalendarPage() {
  const [rangeFilter, setRangeFilter] = useState<DateRangeFilter>("upcoming");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    document.title = "Calendar | KTP";
  }, []);

  const appointmentsQuery = trpc.clinical.listAppointments.useQuery();
  const appointments = appointmentsQuery.data ?? [];

  const today = todayDate();
  const nowMs = Date.now();
  const oneWeekLaterMs = nowMs + 7 * 24 * 60 * 60 * 1000;

  // Compute summary stats
  const totalCount = appointments.length;
  const confirmedCount = appointments.filter((a) => a.response === "Confirmed").length;
  const rescheduleCount = appointments.filter((a) => a.response === "RescheduleRequested").length;
  const pendingCount = appointments.filter((a) => !a.response || a.response === "Pending").length;

  // Filter list
  const filteredAppointments = appointments.filter((appt) => {
    const apptTime = new Date(appt.startsAt).getTime();
    const apptDateKey = dateKey(appt.startsAt);

    // Range filter
    if (rangeFilter === "upcoming" && apptTime < nowMs - 24 * 60 * 60 * 1000) {
      return false;
    }
    if (rangeFilter === "today" && apptDateKey !== today) {
      return false;
    }
    if (rangeFilter === "week" && (apptTime < nowMs - 24 * 60 * 60 * 1000 || apptTime > oneWeekLaterMs)) {
      return false;
    }
    if (rangeFilter === "past" && apptTime >= nowMs - 24 * 60 * 60 * 1000) {
      return false;
    }

    // Kind filter
    if (kindFilter !== "all" && appt.kind !== kindFilter) {
      return false;
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchPatient = appt.patientName?.toLowerCase().includes(q);
      const matchHrn = appt.hrn?.toLowerCase().includes(q);
      const matchTitle = appt.title?.toLowerCase().includes(q);
      if (!matchPatient && !matchHrn && !matchTitle) {
        return false;
      }
    }

    return true;
  });

  return (
    <MotionRoot intensity="full">
      <AdminToaster>
        <div data-surface="admin" className="relative isolate min-h-dvh bg-ground text-ink">
          <OrganGridBackdrop />
          <AdminShell
            current="calendar"
            hrefs={ADMIN_HREFS}
            hideUnavailable={false}
            mobileTitle="Calendar"
            skipTo="calendar-main"
            skipLabel="Skip to calendar"
          >
            <PageTransition routeKey="admin-calendar" focusHeading={false}>
              <div id="calendar-main" className="flex flex-col gap-6 p-4 md:p-8">
                {/* Header */}
                <header className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-6 text-olive" />
                    <h1 className="type-display text-ink">Unit Clinic Calendar</h1>
                  </div>
                  <p className="type-body-sm text-ink-muted">
                    Scheduled follow-up visits, biopsies, and workup appointments across all patients
                  </p>
                </header>

                {/* Summary Stat Pills */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ClayCard className="p-4">
                    <p className="type-caption text-ink-muted">Total Appointments</p>
                    <p className="font-mono text-2xl font-bold text-ink">{totalCount}</p>
                  </ClayCard>
                  <ClayCard className="p-4">
                    <p className="type-caption text-olive font-medium">Confirmed by Patient</p>
                    <p className="font-mono text-2xl font-bold text-olive">{confirmedCount}</p>
                  </ClayCard>
                  <ClayCard className={`p-4 ${rescheduleCount > 0 ? "border-l-4 border-l-brick" : ""}`}>
                    <p className="type-caption text-brick font-medium">Reschedule Requested</p>
                    <p className="font-mono text-2xl font-bold text-brick">{rescheduleCount}</p>
                  </ClayCard>
                  <ClayCard className="p-4">
                    <p className="type-caption text-ink-muted">Pending Response</p>
                    <p className="font-mono text-2xl font-bold text-ink-muted">{pendingCount}</p>
                  </ClayCard>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      [
                        { id: "upcoming", label: "Upcoming" },
                        { id: "today", label: "Today" },
                        { id: "week", label: "Next 7 Days" },
                        { id: "all", label: "All" },
                        { id: "past", label: "Past" },
                      ] as const
                    ).map((pill) => (
                      <button
                        key={pill.id}
                        type="button"
                        onClick={() => setRangeFilter(pill.id)}
                        className={`clay-focus rounded-full px-3 py-1 type-body-sm transition ${
                          rangeFilter === pill.id
                            ? "bg-surface-1 font-medium text-ink shadow-sm"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-full sm:w-64">
                      <ClayInput
                        label="Search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search patient or title"
                      />
                    </div>
                  </div>
                </div>

                {/* Loading State */}
                {appointmentsQuery.isLoading && (
                  <ClayCard className="p-8 text-center text-ink-muted">
                    <p className="type-body">Loading clinic appointments...</p>
                  </ClayCard>
                )}

                {/* Error State */}
                {appointmentsQuery.isError && (
                  <ClayCard className="p-8 text-center text-ink">
                    <p className="type-headline text-brick">Failed to load appointments</p>
                    <p className="mt-2 type-body-sm text-ink-muted">Please retry.</p>
                    <div className="mt-4 flex justify-center">
                      <ClayButton onClick={() => appointmentsQuery.refetch()}>Retry</ClayButton>
                    </div>
                  </ClayCard>
                )}

                {/* Empty State */}
                {!appointmentsQuery.isLoading && !appointmentsQuery.isError && filteredAppointments.length === 0 && (
                  <ClayCard className="p-8 text-center text-ink-muted">
                    <p className="type-headline text-ink">No appointments found</p>
                    <p className="mt-2 type-body-sm">
                      No scheduled clinic visits match the selected range and filters.
                    </p>
                  </ClayCard>
                )}

                {/* Appointments List */}
                {!appointmentsQuery.isLoading && filteredAppointments.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {filteredAppointments.map((appt) => {
                      const startDate = new Date(appt.startsAt);
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

                      const isReschedule = appt.response === "RescheduleRequested";
                      const isConfirmed = appt.response === "Confirmed";

                      return (
                        <ClayCard
                          key={appt.id}
                          className={`p-4 sm:p-5 transition ${
                            isReschedule ? "border-l-4 border-l-brick bg-surface-1" : ""
                          }`}
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-xs font-medium text-ink">
                                  {appt.kind}
                                </span>
                                <h2 className="type-headline text-ink">{appt.title}</h2>
                              </div>

                              {/* Patient Reference */}
                              <div className="flex flex-wrap items-center gap-3 type-body-sm">
                                <Link
                                  href={`/patients/${appt.patientId}?tab=appointments`}
                                  className="clay-focus flex items-center gap-1.5 font-medium text-ink hover:underline"
                                >
                                  <User className="size-4 text-ink-muted" />
                                  {appt.patientName} ({appt.hrn})
                                </Link>
                                <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-muted">
                                  {appt.patientType} &bull; {appt.stage}
                                </span>
                                {appt.contactNumber && (
                                  <span className="text-ink-muted font-mono text-xs">
                                    Tel: {appt.contactNumber}
                                  </span>
                                )}
                              </div>

                              {/* Time & Location */}
                              <div className="flex flex-wrap items-center gap-4 type-body-sm text-ink-muted">
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

                              {/* Notes */}
                              {appt.note && (
                                <p className="mt-1 type-body-sm text-ink-muted">
                                  <strong className="text-ink">Instructions:</strong> {appt.note}
                                </p>
                              )}

                              {/* Reschedule Note */}
                              {isReschedule && appt.responseNote && (
                                <div className="mt-2 rounded-xl bg-brick-tint/60 p-3 type-body-sm text-brick">
                                  <strong>Patient Reschedule Request:</strong> {appt.responseNote}
                                </div>
                              )}
                            </div>

                            {/* Response Badge & Action */}
                            <div className="flex flex-col items-start gap-2 sm:items-end">
                              {isConfirmed && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-olive-tint px-3 py-1 font-medium text-olive type-body-sm">
                                  <CheckCircle2 className="size-4" /> Confirmed
                                </span>
                              )}
                              {isReschedule && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-brick-tint px-3 py-1 font-medium text-brick type-body-sm">
                                  Reschedule Requested
                                </span>
                              )}
                              {(!appt.response || appt.response === "Pending") && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink-muted/40 px-3 py-1 font-medium text-ink-muted type-body-sm">
                                  Pending Response
                                </span>
                              )}

                              <Link
                                href={`/patients/${appt.patientId}?tab=appointments`}
                                className="clay-focus text-xs font-medium text-olive hover:underline"
                              >
                                Manage in Patient Profile &rarr;
                              </Link>
                            </div>
                          </div>
                        </ClayCard>
                      );
                    })}
                  </div>
                )}
              </div>
            </PageTransition>
          </AdminShell>
        </div>
      </AdminToaster>
    </MotionRoot>
  );
}
