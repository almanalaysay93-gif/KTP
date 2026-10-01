import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { House } from "lucide-react";
import { ClayAvatar, ClayCard, StatusChip } from "@/components/clay";
import { MotionClayButton, PageTransition, V, useMotionPreset } from "@/components/motion";
import {
  AppointmentList, ClaimDeadlines, DueList, EmergencyBand, MessageList, NextUpCard, PATIENT_TABS, PatientShell,
  PatientToastRegion, StripTray, patientDate, useMediaQuery, usePatientToast,
  type ActionResult, type AppointmentView, type ClaimItemView, type DueItemView, type MessageView, type PatientTabId,
  type SectionState, type StripCell,
} from "@/components/ktp/patient";
import {
  APPOINTMENTS, FEATURED_PATIENT_ID, MESSAGES, MOCK_TODAY, SERVICE_RECORDS, SERVICE_TYPE_LABEL, claimStatus, dueState,
  patientById, type ServiceRecord, type ServiceType,
} from "./mock";
import { cn } from "@/lib/utils";

/* Fictional sample data, shaped into patient view models (COPY.md 6.8). */

const TODAY = MOCK_TODAY;
const PATIENT = patientById(FEATURED_PATIENT_ID)!;
/** Clearly fictional stand-in for appSettings.emergencyHotlineText. */
const SAMPLE_HOTLINE = { text: "Sample hotline 0000 000 0000", tel: "00000000000" };
const PREVIEW_NOTE = "Preview only. Nothing was sent to the KT unit.";

const EXPLAIN: Record<ServiceType, string> = {
  Meds: "Your recurring medicine claim, tracked by the KT unit.",
  Laboratory: "Blood and urine tests your care team uses to follow your health.",
  Tacro: "A blood test for your tacrolimus level. Tacrolimus is one of your transplant medicines.",
  XrayUsd: "Imaging tests: a chest X-ray and an ultrasound (USD) scan.",
};

function serviceName(record: ServiceRecord) {
  return record.serviceType === "Laboratory" ? `Laboratory, ${record.label}` : SERVICE_TYPE_LABEL[record.serviceType];
}

const mine = SERVICE_RECORDS.filter((r) => r.patientId === PATIENT.id);

const DUE_ITEMS: DueItemView[] = mine
  .filter((r) => r.status === "Planned")
  .map((r) => ({ id: r.id, name: serviceName(r), dueDate: r.dueDate, state: dueState(r, TODAY)!, explain: EXPLAIN[r.serviceType] }))
  .sort((a, b) => {
    const pastA = a.state === "Overdue" ? 0 : 1;
    const pastB = b.state === "Overdue" ? 0 : 1;
    return pastA - pastB || (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0);
  });

const NEXT_DATE = DUE_ITEMS.find((i) => i.state !== "Overdue")?.dueDate;
const NEXT_GROUP = DUE_ITEMS.filter((i) => i.dueDate === NEXT_DATE);

const CLAIMS: ClaimItemView[] = mine
  .filter((r) => r.status !== "Planned" && r.serviceDate && r.claimDeadline && !r.claimFiledDate)
  .map((r) => ({
    id: r.id,
    name: `${SERVICE_TYPE_LABEL[r.serviceType]}${r.repeatOfId ? " repeat" : ""}`,
    serviceDate: r.serviceDate!,
    deadline: r.claimDeadline!,
    status: claimStatus(r, TODAY) as ClaimItemView["status"],
    repeated: r.status === "Superseded",
  }))
  .sort((a, b) => (a.deadline < b.deadline ? -1 : 1));

const INITIAL_APPTS: AppointmentView[] = APPOINTMENTS.filter(
  (a) =>
    a.patientId === PATIENT.id &&
    !a.cancelledAt &&
    (typeof a.startsAt === "string" ? a.startsAt : (a.startsAt as any)?.toISOString?.() ?? "").slice(0, 10) >= TODAY,
)
  .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))
  .map(({ id, title, startsAt, location, response, responseNote }) => ({ id, title, startsAt, location, response, responseNote }));

const INITIAL_MESSAGES: MessageView[] = MESSAGES.filter((m) => m.patientId === PATIENT.id)
  .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))
  .map(({ id, title, body, sentAt, readAt, acknowledgedAt }) => ({ id, title, body, sentAt, readAt, acknowledgedAt }));

/* Preview controls: ?state=loading|empty|error, or the switcher at the bottom of the page. */

type PreviewState = "ready" | "loading" | "empty" | "error";
const PREVIEW_STATES: { id: PreviewState; label: string }[] = [
  { id: "ready", label: "Sample" },
  { id: "loading", label: "Loading" },
  { id: "empty", label: "Empty" },
  { id: "error", label: "Error" },
];

function initialPreviewState(): PreviewState {
  if (typeof window === "undefined") return "ready";
  const value = new URLSearchParams(window.location.search).get("state");
  return PREVIEW_STATES.some((s) => s.id === value) ? (value as PreviewState) : "ready";
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export default function PatientHomePreview() {
  const [tab, setTab] = useState<PatientTabId>("home");
  const [previewState, setPreviewState] = useState<PreviewState>(initialPreviewState);
  const [forceReduced, setForceReduced] = useState(false);
  const [appointments, setAppointments] = useState(INITIAL_APPTS);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const { toast, show, dismiss } = usePatientToast();
  const navigated = useRef(false);
  // Each breakpoint gets its own DOM order, so focus order always matches what is on screen.
  const desktop = useMediaQuery("(min-width: 1024px)");

  const label = PATIENT_TABS.find((t) => t.id === tab)?.label ?? "Home";
  useEffect(() => {
    document.title = `${label} | KTP`;
  }, [label]);

  const empty = previewState === "empty";
  const sectionState: SectionState = previewState === "loading" || previewState === "error" ? previewState : "ready";
  const unread = empty || sectionState !== "ready" ? 0 : messages.filter((m) => !m.readAt).length;

  const navigate = useCallback((id: PatientTabId) => {
    navigated.current = true;
    setTab(id);
    window.scrollTo({ top: 0 });
  }, []);

  const previewOnly = useCallback(
    (title: string, body: string) => (event?: MouseEvent) => {
      event?.preventDefault();
      show({ tone: "info", title, body });
    },
    [show],
  );

  const confirm = async (id: string): Promise<ActionResult> => {
    await wait(700);
    const appt = appointments.find((a) => a.id === id);
    setAppointments((list) => list.map((a) => (a.id === id ? { ...a, response: "Confirmed" } : a)));
    show({
      tone: "done",
      title: `Thanks. Your appointment on ${appt ? patientDate(appt.startsAt, TODAY) : "that day"} is confirmed.`,
      body: PREVIEW_NOTE,
    });
    return { ok: true };
  };

  const requestNewTime = async (id: string, note: string): Promise<ActionResult> => {
    await wait(800);
    setAppointments((list) =>
      list.map((a) => (a.id === id ? { ...a, response: "RescheduleRequested", responseNote: note } : a)),
    );
    show({ tone: "done", title: "Request sent. You will get a notice when the KT unit sets a new time.", body: PREVIEW_NOTE });
    return { ok: true };
  };

  const markRead = (id: string) =>
    setMessages((list) => list.map((m) => (m.id === id && !m.readAt ? { ...m, readAt: TODAY } : m)));

  const acknowledge = async (id: string): Promise<ActionResult> => {
    await wait(600);
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, readAt: m.readAt ?? TODAY, acknowledgedAt: TODAY } : m)));
    show({ tone: "done", title: "Thanks. The KT unit can see that you read this.", body: PREVIEW_NOTE });
    return { ok: true };
  };

  const retry = () => setPreviewState("ready");
  const avatar = (
    <button
      type="button"
      title="Preview only"
      aria-label="Open your profile, preview only"
      onClick={previewOnly("Preview only", "Your profile is not part of the preview.")}
      className="clay-focus inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full"
    >
      <ClayAvatar decorative name={`${PATIENT.firstName} ${PATIENT.lastName}`} kind="recipient" size={40} />
    </button>
  );

  const nextUp = <NextUpCard items={empty ? [] : NEXT_GROUP} today={TODAY} state={sectionState} onRetry={retry} />;
  const strip = <StripTray state={sectionState} onRetry={retry} cells={stripCells(empty, unread)} />;
  const appointmentList = (
    <AppointmentList
      items={empty ? [] : appointments}
      today={TODAY}
      state={sectionState}
      onRetry={retry}
      onConfirm={confirm}
      onRequestNewTime={requestNewTime}
    />
  );
  const dueList = <DueList items={empty ? [] : DUE_ITEMS} today={TODAY} state={sectionState} onRetry={retry} />;
  const claimList = <ClaimDeadlines items={empty ? [] : CLAIMS} today={TODAY} state={sectionState} onRetry={retry} />;
  const messageList = (
    <MessageList
      items={empty ? [] : messages}
      today={TODAY}
      state={sectionState}
      onRetry={retry}
      onRead={markRead}
      onAcknowledge={acknowledge}
      emergency={
        <EmergencyBand
          hotlineText={SAMPLE_HOTLINE.text}
          hotlineTel={SAMPLE_HOTLINE.tel}
          onCall={previewOnly("Preview only", "Calls are off in the preview. This hotline is not real.")}
        />
      }
    />
  );

  return (
    <PatientShell
      active={tab}
      onNavigate={navigate}
      unread={unread}
      tabs={PATIENT_TABS.map((t) => (t.id === "home" ? t : { ...t, previewOnly: true }))}
      reducedMotion={forceReduced ? "always" : "user"}
      topBarEnd={
        <>
          <SampleBadge />
          {avatar}
        </>
      }
      overlay={<PatientToastRegion toast={toast} onDismiss={dismiss} />}
    >
      <HomeTransition tab={tab} navigated={navigated.current}>
        {tab === "home" ? (
          <div className="flex flex-col gap-4 lg:gap-6">
            <header className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <img src="/branding/ots-mark.png" alt="Organ Transplant Services" width={36} height={36} className="size-9 shrink-0 rounded-xs mix-blend-multiply max-[359px]:hidden lg:hidden" />
                  <h1 className="type-display min-w-0 flex-1 text-ink max-[359px]:text-[1.375rem] max-[359px]:leading-7">Hi, {PATIENT.firstName}</h1>
                  <div className="flex shrink-0 items-center gap-1 lg:hidden">
                    <SampleBadge compact />
                    {avatar}
                  </div>
                </div>
                <p className="type-body-lg text-ink-muted">Here is what is coming up.</p>
              </div>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 lg:justify-end lg:pb-1">
                <span className="type-label inline-flex h-8 items-center rounded-full bg-surface-1 px-3 text-sage-deep">
                  After your transplant
                </span>
                <span className="type-body-sm text-ink-muted">
                  Transplant date: <span className="type-data text-ink">{patientDate(PATIENT.surgeryDate!, TODAY)}</span>
                </span>
              </p>
            </header>

            {desktop ? (
              <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-start gap-6">
                <div className="flex flex-col gap-6">
                  {nextUp}
                  {appointmentList}
                  {dueList}
                </div>
                <div className="flex flex-col gap-6">
                  {strip}
                  {claimList}
                  {messageList}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {nextUp}
                {strip}
                {appointmentList}
                {dueList}
                {claimList}
                {messageList}
              </div>
            )}

            <PreviewControls
              value={previewState}
              onChange={setPreviewState}
              reduced={forceReduced}
              onReducedChange={setForceReduced}
            />
          </div>
        ) : (
          <PreviewOnlyPage label={label} onHome={() => navigate("home")} />
        )}
      </HomeTransition>
    </PatientShell>
  );
}

function stripCells(empty: boolean, unread: number): [StripCell, StripCell, StripCell] {
  const next = NEXT_DATE ? patientDate(NEXT_DATE, TODAY) : "";
  const claimsSoon = CLAIMS.filter((c) => c.status === "DueSoon").length;
  return [
    {
      id: "due", label: "Due", href: "#due-next",
      value: empty ? 0 : DUE_ITEMS.length,
      // No-break spaces keep the date on one line inside the narrow cell.
      sub: empty ? "Nothing yet" : `next ${next.replace(/ /g, "\u00a0")}`,
      subText: empty ? "nothing yet" : `next ${next}`,
    },
    {
      id: "claims", label: "Claims", href: "#claims",
      value: empty ? 0 : CLAIMS.length,
      sub: empty ? "None open" : `${claimsSoon} due soon`,
      subText: empty ? "none open" : `${claimsSoon} due soon`,
    },
    {
      id: "messages", label: "Messages", href: "#messages",
      value: unread,
      sub: "new", subText: "new",
    },
  ];
}

/**
 * Tab switches use the patient page transition (y 8 on `gentle`). Home itself only fades, so the
 * emergency band on it never moves. The first load plays no page transition at all: the next-up
 * entrance and the strip stagger are the only entrances on first paint.
 */
function HomeTransition({ tab, navigated, children }: { tab: PatientTabId; navigated: boolean; children: ReactNode }) {
  const preset = useMotionPreset();
  const variants = useMemo(
    () =>
      tab === "home" && !preset.reduced
        ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } }, exit: preset.page.exit }
        : preset.page,
    [tab, preset],
  );
  return (
    <PageTransition routeKey={tab} variants={variants} initial={navigated ? V.hidden : false}>
      {children}
    </PageTransition>
  );
}

function SampleBadge({ compact = false }: { compact?: boolean }) {
  return (
    <StatusChip
      status="info"
      label={compact ? "Sample" : "Sample data"}
      size="patient"
      srDetail="fictional patients for preview only"
      title="Fictional patients for preview only. No real patient data."
    />
  );
}

function PreviewOnlyPage({ label, onHome }: { label: string; onHome: () => void }) {
  return (
    <ClayCard level={2} className="mx-auto mt-4 flex max-w-[560px] flex-col items-start gap-3 lg:mt-12">
      <StatusChip status="info" label="Preview only" size="patient" />
      <h1 className="type-display text-ink">{label}</h1>
      <p className="type-body-lg text-ink-muted">This screen is not part of the preview yet.</p>
      <MotionClayButton variant="secondary" size="lg" icon={<House strokeWidth={1.75} />} onClick={onHome}>
        Go to Home
      </MotionClayButton>
    </ClayCard>
  );
}

function PreviewControls({
  value,
  onChange,
  reduced,
  onReducedChange,
}: {
  value: PreviewState;
  onChange: (next: PreviewState) => void;
  reduced: boolean;
  onReducedChange: (next: boolean) => void;
}) {
  return (
    <aside aria-label="Preview controls" className="mt-4 flex flex-col gap-3 border-t-[1.5px] border-dashed border-line-strong pt-5">
      <p className="type-body-sm text-ink-muted">Preview controls. Not part of the patient screen.</p>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Section state" className="clay-sunken flex flex-wrap gap-1 rounded-2xl p-1">
          {PREVIEW_STATES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={value === s.id}
              onClick={() => onChange(s.id)}
              className={cn(
                "clay-focus type-button h-11 cursor-pointer rounded-xl px-4 transition-colors duration-(--dur-color)",
                value === s.id ? "clay-1 bg-surface-2 text-ink" : "text-ink-muted hover:text-ink",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <MotionClayButton variant="ghost" size="sm" aria-pressed={reduced} onClick={() => onReducedChange(!reduced)}>
          {reduced ? "Reduced motion: on" : "Reduced motion: follow device"}
        </MotionClayButton>
      </div>
    </aside>
  );
}
