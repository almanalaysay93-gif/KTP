import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarClock, ClipboardList, FileClock, History, Home, MessageSquare, Plus, RefreshCw, Send, TriangleAlert, Users,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ClayCard, ClayCardHeader, ClayTabs, ClayTabsList, ClayTabsTrigger, StatusChip, type ClayCellProps } from "@/components/clay";
import {
  AnimatePresence, BreathingRing, CountUp, Entrance, LayoutGroup, MotionClayButton, MotionClayCell, MotionProgressRing,
  MotionRoot, MotionStepper, OrganGridBackdrop, PageTransition, PILL_IDS, SHARED_PILL_HOST, SharedCellBar, SharedPill,
  SheenSkeleton, StaggerTray, Tilt3D, ToastMotion, useChartMotion, useMotionMode, type MotionIntensity,
} from "@/components/motion";
import { cn } from "@/lib/utils";

/* Motion kit demo: every primitive twice, admin (full) beside patient (lively). Fictional data only. */

const I = { strokeWidth: 1.75 } as const;

type CellSpec = Pick<ClayCellProps, "label" | "valueTone" | "sub" | "icon" | "status" | "center"> & { count?: number };
const TRAY: CellSpec[] = [
  { label: "Overdue services", count: 7, valueTone: "overdue", sub: "oldest 12 d", icon: <TriangleAlert {...I} />, status: <StatusChip status="overdue" /> },
  { label: "Claims due in 7 days", count: 5, valueTone: "due-soon", sub: "next Fri 2 Oct", icon: <FileClock {...I} />, status: <StatusChip status="due-soon" /> },
  { label: "Reschedule requests", count: 3, sub: "oldest 2 d", icon: <CalendarClock {...I} /> },
  { label: "Superseded, claim unfiled", count: 2, sub: "deadline Mon 12 Oct", icon: <History {...I} /> },
  { label: "Active patients", count: 64, center: true, sub: "41 recipients, 23 donors", icon: <Users {...I} className="text-sage" /> },
  { label: "Due this week", count: 12, sub: "next Thu 1 Oct", status: <StatusChip status="planned" /> },
  { label: "Recipients, work-up", count: 18, sub: "5 stages" },
  { label: "Recipients, post-KT", count: 23, sub: "newest day 35" },
  { label: "Donors", count: 23, sub: "15 work-up, 8 post-donation" },
];
const STRIP: CellSpec[] = [
  { label: "Due", count: 2, icon: <CalendarClock {...I} /> },
  { label: "Claims", count: 1, icon: <FileClock {...I} /> },
  { label: "Messages", count: 2, icon: <MessageSquare {...I} /> },
];
const STEPS = ["Orientation", "Phase 1", "Phase 2", "Clearances", "PhilHealth Z", "Phase 3", "Post-KT"].map((label) => ({ id: label, label }));
const TABS = ["Tracker", "Labs", "Checklist", "History"];
const NAV = [
  { id: "home", label: "Home", Icon: Home },
  { id: "labs", label: "Labs", Icon: ClipboardList },
  { id: "msgs", label: "Messages", Icon: MessageSquare },
];
const PAGES = ["Triage", "Patients", "Calendar"];
/* Creatinine, umol/L, fictional. Reference range 62 to 106. */
const LABS = [
  { day: "2 Jun", v: 96 }, { day: "30 Jun", v: 101 }, { day: "28 Jul", v: 99 },
  { day: "25 Aug", v: 108 }, { day: "22 Sep", v: 112 }, { day: "24 Sep", v: 118 },
];

function Section({ id, title, lede, children }: { id: string; title: string; lede: string; children: (i: MotionIntensity) => ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-4">
      <div>
        <h2 id={`${id}-h`} className="type-headline">{title}</h2>
        <p className="type-body mt-1 max-w-[68ch] text-ink-muted">{lede}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Lane intensity="full" id={id}>{children("full")}</Lane>
        <Lane intensity="lively" id={id}>{children("lively")}</Lane>
      </div>
    </section>
  );
}

function Lane({ intensity, id, children }: { intensity: MotionIntensity; id: string; children: ReactNode }) {
  return (
    <MotionRoot intensity={intensity}>
      <LayoutGroup id={`${id}-${intensity}`}>
        <div
          data-surface={intensity === "full" ? "admin" : "patient"}
          data-lane={intensity}
          className="flex min-w-0 flex-col gap-3 rounded-lg bg-row-hover p-4 lg:p-5"
        >
          <LaneLabel intensity={intensity} />
          {children}
        </div>
      </LayoutGroup>
    </MotionRoot>
  );
}

function LaneLabel({ intensity }: { intensity: MotionIntensity }) {
  const mode = useMotionMode();
  return (
    <p className="type-label flex flex-wrap items-center gap-2 text-ink-muted">
      <span className="text-ink">{intensity === "full" ? "Admin surface" : "Patient surface"}</span>
      <span className="type-data" data-motion-mode={mode}>mode: {mode}</span>
    </p>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="type-body-sm text-ink-muted">{children}</p>;
}

function TrayDemo({ intensity }: { intensity: MotionIntensity }) {
  const [selected, setSelected] = useState(0);
  const cells = intensity === "full" ? TRAY : STRIP;
  return (
    <div className="flex flex-col gap-3">
      {intensity === "lively" ? (
        <Entrance>
          <ClayCard className="flex flex-col gap-1">
            <StatusChip status="due-soon" size="patient" />
            <span className="type-title">Tacro test</span>
            <span className="type-numeral-xl">Fri 2 Oct</span>
            <span className="type-body-lg text-ink-muted">in 2 days</span>
          </ClayCard>
        </Entrance>
      ) : null}
      <StaggerTray label={intensity === "full" ? "Triage counts, sample" : "Next items, sample"} layout={intensity === "full" ? "3x3" : "1x3"}>
        {cells.map(({ count, ...cell }, i) => (
          <MotionClayCell
            key={cell.label as string}
            {...cell}
            value={count === undefined ? undefined : <CountUp value={count} />}
            selected={intensity === "full" && !cell.center ? selected === i : undefined}
            onClick={() => setSelected(i)}
          >
            {intensity === "full" && selected === i && !cell.center ? <SharedCellBar /> : null}
          </MotionClayCell>
        ))}
      </StaggerTray>
      <Note>
        {intensity === "full"
          ? "Cells rise 45 ms apart, center last with a 1.04 overshoot. Hover tilts toward the pointer. Select a cell: the bar morphs."
          : "Next-up card enters once, strip cells rise 60 ms apart on the gentle spring. No tilt, no count-up."}
      </Note>
    </div>
  );
}

function PressDemo({ intensity }: { intensity: MotionIntensity }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <MotionClayButton icon={<Plus {...I} />} size={intensity === "full" ? "md" : "lg"}>Enroll patient</MotionClayButton>
        <MotionClayButton variant="secondary" icon={<Send {...I} />}>Send message</MotionClayButton>
        <MotionClayButton variant="ghost">View all 5</MotionClayButton>
        <MotionClayButton variant="icon" aria-label="Refresh"><RefreshCw {...I} /></MotionClayButton>
        <MotionClayButton variant="secondary" disabled>Disabled</MotionClayButton>
      </div>
      <Note>{intensity === "full" ? "Press: scaleX 1.03, scaleY 0.94, released on the press spring." : "Press: scale 0.97 only, gentle spring."}</Note>
    </div>
  );
}

function TiltDemo({ intensity }: { intensity: MotionIntensity }) {
  return (
    <div className="flex flex-col gap-3">
      <Tilt3D
        data-testid={`tilt-${intensity}`}
        className="clay-2 flex min-h-36 flex-col justify-between rounded-lg bg-surface-1 p-(--card-pad) lg:rounded-xl"
      >
        <span className="type-title">Pacaldo, Lorna M.</span>
        <span className="type-data text-ink-muted">HRN 00-418-227</span>
      </Tilt3D>
      <Note>{intensity === "full" ? "Up to 5 deg toward the pointer with a moving highlight. Fine pointers only." : "Off on patient surfaces: the card stays flat."}</Note>
    </div>
  );
}

function CountDemo({ intensity }: { intensity: MotionIntensity }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-8">
        <span className="type-numeral-xl text-overdue"><CountUp value={7} /></span>
        <span className="type-numeral-xl"><CountUp value={1284} /></span>
        <span className="flex items-baseline gap-1">
          <span className="type-data-lg"><CountUp value={118.4} decimals={1} /></span>
          <span className="type-body-sm text-ink-muted">umol/L</span>
        </span>
      </div>
      <Note>{intensity === "full" ? "0 to value over 700 ms on first view. Screen readers hear only the final value." : "Final value immediately: dates and deadlines must read at once."}</Note>
    </div>
  );
}

function PillDemo({ intensity }: { intensity: MotionIntensity }) {
  const [tab, setTab] = useState("tracker");
  const [nav, setNav] = useState("home");
  return (
    <div className="flex flex-col gap-4">
      <ClayTabs value={tab} onValueChange={setTab}>
        <ClayTabsList aria-label="Profile sections, sample">
          {TABS.map((t) => (
            <ClayTabsTrigger key={t} value={t.toLowerCase()} className={SHARED_PILL_HOST}>
              {tab === t.toLowerCase() ? <SharedPill id={PILL_IDS.tab} /> : null}
              {t}
            </ClayTabsTrigger>
          ))}
        </ClayTabsList>
      </ClayTabs>
      <nav aria-label={intensity === "full" ? "Sidebar, sample" : "Tab bar, sample"}>
        <ul className={cn("flex gap-1", intensity === "full" ? "w-56 flex-col" : "clay-2 w-fit rounded-xl bg-surface-2 p-1.5")}>
          {NAV.map(({ id, label, Icon }) => (
            <li key={id}>
              <button
                type="button"
                aria-current={nav === id ? "page" : undefined}
                onClick={() => setNav(id)}
                className={cn(
                  SHARED_PILL_HOST,
                  "clay-focus flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-full px-4 type-button",
                  intensity === "lively" && "min-h-13 flex-col justify-center gap-0.5 rounded-lg px-3 type-label",
                  nav === id ? "text-ink" : "text-ink-muted",
                )}
              >
                {nav === id ? <SharedPill id={intensity === "full" ? PILL_IDS.nav : PILL_IDS.tabbar} surface={1} className={intensity === "lively" ? "rounded-lg" : undefined} /> : null}
                <Icon {...I} className="size-5" aria-hidden />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <Note>{intensity === "full" ? "tab-pill and nav-pill slide on the layout spring." : "tabbar-pill slides on the gentle spring."}</Note>
    </div>
  );
}

function PageDemo({ intensity }: { intensity: MotionIntensity }) {
  const [page, setPage] = useState(PAGES[0]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PAGES.map((p) => (
          <MotionClayButton key={p} variant={p === page ? "secondary" : "ghost"} size="sm" aria-pressed={p === page} onClick={() => setPage(p)}>
            {p}
          </MotionClayButton>
        ))}
      </div>
      <div className="clay-sunken min-h-40 rounded-lg p-3">
        <PageTransition routeKey={page} focusHeading={false}>
          <ClayCard className="flex flex-col gap-1">
            <h3 className="type-title">{page}</h3>
            <p className="type-body-sm text-ink-muted">Sample page body for the {page.toLowerCase()} route.</p>
          </ClayCard>
        </PageTransition>
      </div>
      <Note>{intensity === "full" ? "Exit: fade and y -8 in 120 ms. Enter: y 16 on the page spring." : "Enter: y 8 on the gentle spring. Exit: 120 ms fade."}</Note>
    </div>
  );
}

function StepperDemo({ intensity }: { intensity: MotionIntensity }) {
  return (
    <div className="flex flex-col gap-4">
      <MotionStepper steps={STEPS} current={6} compact="always" trailing="Post-KT day 214" label="Stage progress, sample" />
      <div className="flex items-center gap-3">
        <span className="clay-1 relative inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ink">
          <span className="size-2.5 rounded-full bg-peach" />
          <BreathingRing />
        </span>
        <Note>{intensity === "full" ? "Connectors fill left to right, current node breathes every 2.4 s." : "No fill sweep, no perpetual loops."}</Note>
      </div>
    </div>
  );
}

function RingDemo({ intensity }: { intensity: MotionIntensity }) {
  const [done, setDone] = useState(31);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <MotionProgressRing size={72} value={done} max={42} label="Work-up checklist, sample" valueText={`${done} of 42 done`} />
        <MotionClayButton variant="secondary" size="sm" onClick={() => setDone((d) => (d >= 42 ? 12 : Math.min(42, d + 6)))}>
          Add 6 done
        </MotionClayButton>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <SheenSkeleton shape="circle" className="size-12" />
        <SheenSkeleton className="h-12" />
      </div>
      <Note>{intensity === "full" ? "Ring fills in 600 ms. Skeletons sweep a peach sheen once (1.6 s), then rest." : "Ring fills in 600 ms. Skeletons stay static."}</Note>
    </div>
  );
}

function ChartDemo({ intensity }: { intensity: MotionIntensity }) {
  const chart = useChartMotion();
  return (
    <ClayCard>
      <ClayCardHeader title="Creatinine" description="6 results, latest 118 umol/L on 24 Sep, High" />
      <figure className="h-48" aria-label="Creatinine trend, sample">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={LABS} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <ReferenceArea y1={62} y2={106} fill="var(--sage-tint)" fillOpacity={1} className={chart.bandClassName} ifOverflow="extendDomain" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--ink-muted)" }} tickLine={false} axisLine={false} />
            <YAxis domain={[50, 130]} tick={{ fontSize: 12, fill: "var(--ink-muted)" }} tickLine={false} axisLine={false} />
            <Line
              type="monotone"
              dataKey="v"
              stroke="var(--series-2)"
              strokeWidth={2}
              {...chart.line}
              dot={(p: { cx?: number; cy?: number; index: number; value?: number }) => (
                <g key={p.index} {...chart.point(p.index)}>
                  {p.value !== undefined && p.value > 106 ? (
                    <path d={`M${p.cx} ${(p.cy ?? 0) - 6}l6 10h-12z`} fill="var(--lab-high)" />
                  ) : (
                    <circle cx={p.cx} cy={p.cy} r={4.5} fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth={2} />
                  )}
                </g>
              )}
            />
          </LineChart>
        </ResponsiveContainer>
      </figure>
      <Note>{intensity === "full" ? "Band fades in 200 ms, line draws over 900 ms, points pop 40 ms apart." : "Band fades, line draws over 600 ms, points fade in."}</Note>
    </ClayCard>
  );
}

function ToastDemo({ intensity }: { intensity: MotionIntensity }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setOpen(false), 5000);
    return () => window.clearTimeout(t);
  }, [open]);
  return (
    <div className="flex min-h-40 flex-col items-start gap-3">
      <MotionClayButton variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide toast" : "Show toast"}
      </MotionClayButton>
      <AnimatePresence>
        {open ? (
          <ToastMotion key="toast" role="status" className="clay-3 flex w-full max-w-[360px] items-start gap-3 rounded-xl bg-surface-2 p-4">
            <StatusChip status="done" size={intensity === "full" ? "admin" : "patient"} />
            <span className="type-body">Result saved for the sample patient.</span>
          </ToastMotion>
        ) : null}
      </AnimatePresence>
      <Note>{intensity === "full" ? "From y 24 and scale 0.96 on pop; exits with a fade and y 8." : "From y 16 on gentle; same exit."}</Note>
    </div>
  );
}

export default function MotionPreview() {
  const [run, setRun] = useState(0);
  const [forceReduced, setForceReduced] = useState(false);
  useEffect(() => {
    document.title = "Motion | KTP";
  }, []);

  return (
    <MotionRoot intensity="full" reducedMotion={forceReduced ? "always" : "user"}>
      <div data-surface="admin" className="relative isolate min-h-dvh bg-ground text-ink">
        <OrganGridBackdrop />
        <div className="mx-auto w-full max-w-[1280px] px-4 py-10 md:px-6 lg:px-8 lg:py-14">
          <header className="flex max-w-[68ch] flex-col items-start gap-3">
            <StatusChip status="info" label="Sample data" srDetail="fictional patients for preview only" title="Fictional patients for preview only. No real patient data." />
            <h1 className="type-display">KTP motion</h1>
            <p className="type-body-lg text-ink-muted">
              Each primitive runs twice: admin surfaces at full intensity, patient surfaces calmer. Reduced motion collapses both to short fades.
              The organ-grid backdrop behind this page is admin only.
            </p>
            <div className="flex flex-wrap gap-3">
              <MotionClayButton variant="secondary" icon={<RefreshCw {...I} />} onClick={() => setRun((r) => r + 1)}>
                Replay entrances
              </MotionClayButton>
              <MotionClayButton variant="ghost" aria-pressed={forceReduced} onClick={() => setForceReduced((f) => !f)}>
                {forceReduced ? "Reduced motion: on" : "Reduced motion: follow device"}
              </MotionClayButton>
            </div>
          </header>

          <main key={run} className="mt-10 flex flex-col gap-(--section-gap)">
            <Section id="tray" title="Tray entrance, tilt, shared bar" lede="The Nine-Cell Tray on admin, the 1x3 strip and next-up card on patient.">
              {(i) => <TrayDemo intensity={i} />}
            </Section>
            <Section id="press" title="Press squish and hover lift" lede="Primary controls only. Disabled buttons do not squish.">
              {(i) => <PressDemo intensity={i} />}
            </Section>
            <Section id="tilt" title="3D tilt" lede="Pointer-follow tilt with a radial highlight, gated to hover-capable fine pointers.">
              {(i) => <TiltDemo intensity={i} />}
            </Section>
            <Section id="count" title="Count-up numbers" lede="Mono numerals with reserved width, so nothing shifts while counting.">
              {(i) => <CountDemo intensity={i} />}
            </Section>
            <Section id="pills" title="Shared-layout indicators" lede="One raised pill moves between items instead of fading in place.">
              {(i) => <PillDemo intensity={i} />}
            </Section>
            <Section id="page" title="Page transition" lede="AnimatePresence in wait mode: the old page leaves before the new one enters.">
              {(i) => <PageDemo intensity={i} />}
            </Section>
            <Section id="stepper" title="Stepper" lede="Connector fill on mount and the breathing current node.">
              {(i) => <StepperDemo intensity={i} />}
            </Section>
            <Section id="ring" title="Progress ring and skeleton" lede="Ring fill runs on both surfaces; the one-sweep sheen is admin only.">
              {(i) => <RingDemo intensity={i} />}
            </Section>
            <Section id="chart" title="Chart draw-in" lede="Reference band, then the line, then the points.">
              {(i) => <ChartDemo intensity={i} />}
            </Section>
            <Section id="toast" title="Toast" lede="Status toasts rise in and leave quickly. They pause on hover or focus in the real toaster.">
              {(i) => <ToastDemo intensity={i} />}
            </Section>
          </main>
        </div>
      </div>
    </MotionRoot>
  );
}
