import { useEffect, useMemo, useState } from "react";
import { ClipboardPen } from "lucide-react";
import { ClayCard, ClayTabs, ClayTabsContent, ClayTabsList, ClayTabsTrigger, ClayTray } from "@/components/clay";
import {
  AdminShell, AdminToaster, AppointmentsPanel, ChecklistPanel, HistoryPanel, LabTrendChart, LabValuesTable,
  MessagesPanel, PatientHeader, PatientTray, ServiceActionDialog, ServiceRecordsTable, ServiceTracker,
  useAdminToast, usePreviewState, type ServiceAction, type TrayTarget,
} from "@/components/ktp/admin";
import {
  Entrance, LayoutGroup, MotionClayButton, MotionRoot, OrganGridBackdrop, PageTransition, PILL_IDS, SHARED_PILL_HOST,
  SharedPill, useMotionMode,
} from "@/components/motion";
import { cn } from "@/lib/utils";
import {
  DOCTORS, FEATURED_PATIENT_ID, LAB_TESTS, MOCK_DATASET, MOCK_TODAY, claimStatus, labSeries, patientById,
  serviceTrackers, type Patient, type ServiceType,
} from "./mock";
import { SampleDataBadge } from "./PreviewRoutes";

/* Patient profile tracker wow screen (DESIGN.md Screens 4, spec 7.1). Admin view of the featured patient. */

const HREFS = { dashboard: "/admin", patients: "/patient" } as const;
const TABS = ["tracker", "labs", "checklist", "appointments", "messages", "history"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  tracker: "Tracker",
  labs: "Labs",
  checklist: "Checklist",
  appointments: "Appointments",
  messages: "Messages",
  history: "History",
};

export default function PatientProfilePreview() {
  useEffect(() => {
    // No names in document titles (DESIGN.md Don'ts).
    document.title = "Patient profile | KTP";
  }, []);

  return (
    <MotionRoot intensity="full">
      <AdminToaster>
        <div data-surface="admin" className="relative isolate min-h-dvh bg-ground text-ink">
          <OrganGridBackdrop />
          <Profile />
        </div>
      </AdminToaster>
    </MotionRoot>
  );
}

function Profile() {
  const toast = useAdminToast();
  const mode = useMotionMode();
  const [previewState, retry] = usePreviewState();
  const [tab, setTab] = useState<Tab>("tracker");
  const [filter, setFilter] = useState<ServiceType | "all">("all");
  const [focus, setFocus] = useState<ServiceType | null>(null);
  const [action, setAction] = useState<ServiceAction | null>(null);

  const data = MOCK_DATASET;
  const patient = patientById(FEATURED_PATIENT_ID, data) as Patient;
  const linked = data.patients.find((p) => p.patientType === "Donor" && p.linkedRecipientId === patient.id) ?? null;

  const model = useMemo(() => {
    const records = data.serviceRecords.filter((r) => r.patientId === patient.id);
    const trackers = serviceTrackers(patient.id, data, MOCK_TODAY);
    const appointments = data.appointments.filter((a) => a.patientId === patient.id && !a.cancelledAt);
    const nextAppointment =
      [...appointments]
        .filter((a) => (typeof a.startsAt === "string" ? a.startsAt : (a.startsAt as any)?.toISOString?.() ?? "").slice(0, 10) >= MOCK_TODAY)
        .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))[0] ?? null;
    const claimStates = records.filter((r) => r.status !== "Planned").map((r) => claimStatus(r, MOCK_TODAY));
    const claims = {
      unfiled: claimStates.filter((c) => c === "Overdue" || c === "DueSoon" || c === "Open").length,
      overdue: claimStates.filter((c) => c === "Overdue").length,
      dueSoon: claimStates.filter((c) => c === "DueSoon").length,
    };
    const latest = LAB_TESTS.map((t) => labSeries(patient.id, t.id, data)?.points.at(-1)).filter((p) => p !== undefined);
    const labFlags = {
      flagged: latest.filter((p) => p.flag === "High" || p.flag === "Low").length,
      total: latest.length,
      latestDate: latest.map((p) => p.date).sort().at(-1) ?? null,
    };
    const messages = data.messages.filter((m) => m.patientId === patient.id);
    const messageCounts = {
      unread: messages.filter((m) => !m.readAt).length,
      acknowledged: messages.filter((m) => m.acknowledgedAt).length,
      total: messages.length,
    };
    const urgent = records.filter((r) => r.status === "Planned").sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0] ?? null;
    return { records, trackers, appointments, nextAppointment, claims, labFlags, messages, messageCounts, urgent };
  }, [data, patient.id]);

  const previewOnly = (label: string) =>
    toast({ title: "Preview only", body: `${label} is not part of this preview.`, tone: "info" });

  const recordResult = () => model.urgent && setAction({ kind: "result", patient, record: model.urgent });

  const openTarget = (target: TrayTarget) => {
    if ("linked" in target) {
      toast({ title: "Preview only", body: "Only the featured sample patient has a profile in this preview.", tone: "info" });
      return;
    }
    setTab(target.tab);
    if (target.tab === "tracker") {
      setFilter(target.service ?? "all");
      setFocus(target.service ?? null);
    }
    window.requestAnimationFrame(() => {
      document.getElementById("profile-tabs")?.scrollIntoView({ block: "start", behavior: mode === "reduced" ? "auto" : "smooth" });
      document.getElementById(`profile-tab-${target.tab}`)?.focus({ preventScroll: true });
    });
  };

  const tabs = (
    <LayoutGroup id="profile-tabs">
      <ClayTabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <ClayTabsList aria-label="Profile sections" className="max-w-full">
          {TABS.map((t) => (
            <ClayTabsTrigger key={t} id={`profile-tab-${t}`} value={t} className={SHARED_PILL_HOST}>
              {tab === t ? <SharedPill id={PILL_IDS.tab} /> : null}
              {TAB_LABEL[t]}
              {t === "messages" && model.messageCounts.unread > 0 ? (
                <span className="type-label inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 font-mono text-peach">
                  {model.messageCounts.unread}
                  <span className="sr-only"> unread</span>
                </span>
              ) : null}
            </ClayTabsTrigger>
          ))}
        </ClayTabsList>

        <ClayTabsContent value="tracker">
          <Entrance className="flex flex-col gap-6">
            <ClayCard>
              <h2 className="type-title mb-2 px-3 text-ink">Tracked services</h2>
              <ServiceTracker patient={patient} trackers={model.trackers} focus={focus} onAction={setAction} />
            </ClayCard>
            <ClayCard>
              <h2 className="type-title mb-4 text-ink">Service records</h2>
              <ServiceRecordsTable
                patient={patient}
                records={model.records}
                filter={filter}
                onFilterChange={(f) => {
                  setFilter(f);
                  setFocus(f === "all" ? null : f);
                }}
                onAction={setAction}
                onAddService={() => previewOnly("Add service")}
              />
            </ClayCard>
          </Entrance>
        </ClayTabsContent>
        <ClayTabsContent value="labs">
          <Entrance>
            <ClayCard>
              <h2 className="type-title mb-1 text-ink">Lab values</h2>
              <p className="type-body-sm mb-4 text-ink-muted">Superseded results are not charted.</p>
              <LabValuesTable patientId={String(patient.id)} tests={LAB_TESTS} data={data} caption="Lab values" />
            </ClayCard>
          </Entrance>
        </ClayTabsContent>
        <ClayTabsContent value="checklist">
          <Entrance>
            <ClayCard>
              <ChecklistPanel patient={patient} />
            </ClayCard>
          </Entrance>
        </ClayTabsContent>
        <ClayTabsContent value="appointments">
          <Entrance>
            <ClayCard>
              <AppointmentsPanel patient={patient} appointments={model.appointments} onAction={setAction} />
            </ClayCard>
          </Entrance>
        </ClayTabsContent>
        <ClayTabsContent value="messages">
          <Entrance>
            <ClayCard>
              <MessagesPanel messages={model.messages} />
            </ClayCard>
          </Entrance>
        </ClayTabsContent>
        <ClayTabsContent value="history">
          <Entrance>
            <ClayCard>
              <HistoryPanel />
            </ClayCard>
          </Entrance>
        </ClayTabsContent>
      </ClayTabs>
    </LayoutGroup>
  );

  return (
    <AdminShell
      current="patients"
      hrefs={HREFS}
      mobileTitle="Patient profile"
      skipTo="profile"
      skipLabel="Skip to profile"
      mobileActions={
        <MotionClayButton variant="icon" size="sm" aria-label="Record result" onClick={recordResult}>
          <ClipboardPen strokeWidth={1.75} />
        </MotionClayButton>
      }
    >
      <PageTransition routeKey="patient" focusHeading={false}>
        <main id="profile" tabIndex={-1} className="mx-auto w-full max-w-[1120px] px-4 pb-16 pt-3 outline-none md:px-6 lg:px-8 lg:pb-20 lg:pt-8">
          <PatientHeader
            today={MOCK_TODAY}
            patient={patient}
            linked={linked}
            doctors={DOCTORS}
            backHref={HREFS.dashboard}
            badge={<SampleDataBadge />}
            onRecordResult={recordResult}
            onSendMessage={() => previewOnly("Send message")}
            onEdit={() => previewOnly("Edit patient")}
            onOpenLinked={(p) => openTarget({ linked: p })}
          />

          <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:items-start">
            <section aria-label="Patient summary" className="min-w-0 lg:col-span-7">
              {previewState === "loading" ? (
                <ClayTray label="Patient summary" loading loadingLabel="Loading patient..." />
              ) : (
                <PatientTray
                  patient={patient}
                  linked={linked}
                  trackers={model.trackers}
                  nextAppointment={model.nextAppointment}
                  claims={model.claims}
                  labFlags={model.labFlags}
                  messages={model.messageCounts}
                  onOpen={openTarget}
                />
              )}
            </section>
            <div className="min-w-0 lg:col-span-5">
              <LabTrendChart patientId={String(patient.id)} tests={LAB_TESTS} data={data} state={previewState} onRetry={retry} />
            </div>
          </div>

          <section id="profile-tabs" aria-label="Profile sections" className={cn("mt-10 scroll-mt-20 lg:scroll-mt-6")}>
            {tabs}
          </section>
        </main>
      </PageTransition>
      <ServiceActionDialog action={action} onClose={() => setAction(null)} />
    </AdminShell>
  );
}
