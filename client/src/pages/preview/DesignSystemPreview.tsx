import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, CalendarClock, FileClock, History, Plus, RefreshCw, Search, Send, TriangleAlert, Users } from "lucide-react";
import {
  ClayAvatar, ClayAvatarPair, ClayButton, ClayCard, ClayCardEmpty, ClayCardError, ClayCardHeader, ClayCell,
  ClayInput, ClaySkeleton, ClaySkeletonGroup, ClayStepper, ClayTabs, ClayTabsContent, ClayTabsList,
  ClayTabsTrigger, ClayTray, ProgressRing, StatusChip, type ChipStatus, type ClayButtonProps,
  type ClayButtonVariant, type ClayCellProps,
} from "@/components/clay";
import { cn } from "@/lib/utils";

/* Living style guide for DESIGN.md. Values are read from the CSS tokens at runtime, so this page never drifts. */

const I = { strokeWidth: 1.75 } as const;
type Pair = [token: string, fg: string, bg: string, need: number, note: string];

const NEUTRALS: Pair[] = [
  ["--ground", "--ink", "--ground", 4.5, "Page background"],
  ["--surface-1", "--ink", "--surface-1", 4.5, "Cards, tray cells"],
  ["--surface-2", "--ink", "--surface-2", 4.5, "Popovers, secondary buttons"],
  ["--sunken", "--ink", "--sunken", 4.5, "Tray wells, inputs, skeletons"],
  ["--row-hover", "--ink", "--row-hover", 4.5, "Table row hover"],
  ["--hairline", "--hairline", "--surface-1", 0, "Table dividers, decorative"],
  ["--line-strong", "--line-strong", "--sunken", 3, "Input borders, disabled text"],
  ["--ink", "--ink", "--ground", 4.5, "Text, icons, focus ring"],
  ["--ink-muted", "--ink-muted", "--sunken", 4.5, "Secondary text"],
];
const BRAND: Pair[] = [
  ["--brick", "--on-brick", "--brick", 4.5, "Primary action only"],
  ["--brick-hover", "--on-brick", "--brick-hover", 4.5, "Primary hover"],
  ["--maroon", "--emergency-ink", "--maroon", 4.5, "Pressed, emergency band"],
  ["--on-brick", "--on-brick", "--maroon", 4.5, "Text on brick and maroon"],
  ["--sage-deep", "--sage-deep", "--ground", 4.5, "People, progress fill"],
  ["--sage", "--sage", "--surface-1", 3, "People icons only, never text"],
  ["--sage-tint", "--ink", "--sage-tint", 4.5, "Center cell, donor avatar"],
  ["--peach", "--peach", "--ink", 4.5, "Clay highlight, unread badge on ink"],
  ["--peach-tint", "--ink", "--peach-tint", 4.5, "Selected cell, recipient avatar"],
  ["--coral", "--ink", "--coral", 0, "Decorative only"],
  ["--mauve", "--ink", "--mauve", 0, "Decorative only"],
  ["--lilac", "--ink", "--lilac", 0, "Decorative only"],
];
const STATUS: [ChipStatus, string, string][] = [
  ["overdue", "--overdue", "--overdue-bg"], ["due-soon", "--due-soon", "--due-soon-bg"],
  ["planned", "--planned", "--surface-1"], ["done", "--done", "--done-bg"], ["filed", "--filed", "--filed-bg"],
  ["superseded", "--superseded", "--superseded-bg"], ["lab-low", "--lab-low", "--lab-low-bg"],
  ["lab-high", "--lab-high", "--lab-high-bg"], ["lab-normal", "--lab-normal", "--lab-normal-bg"], ["info", "--info", "--info-bg"],
];
const SERIES = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5"];
const ALL_TOKENS = [...NEUTRALS, ...BRAND].flatMap((p) => [p[0], p[1], p[2]])
  .concat(STATUS.flatMap((s) => [s[1], s[2]]), SERIES, ["--surface-1"]);

const TYPE: [string, string, string][] = [
  ["type-numeral-xl", "numeral-xl: Mono 600, 36 to 56", "12"],
  ["type-display", "display: Gabarito 800, 28 to 40", "Villacorta, Analyn F."],
  ["type-headline", "headline: Gabarito 700, 22 to 28", "Claims due within 7 days"],
  ["type-title", "title: Gabarito 700, 18 to 20", "Overdue services"],
  ["type-data-lg", "data-lg: Mono 600, 20 to 24", "96 umol/L"],
  ["type-body-lg", "body-lg: Next 400, 17 to 18 (patient body)", "Here is what is coming up."],
  ["type-body", "body: Next 400, 16", "Planned services past their due date. Counted in Asia/Manila time."],
  ["type-field-label", "field label: Next 700, 15", "Date filed"],
  ["type-button", "button: Next 700, 16 to 15", "Save result"],
  ["type-body-sm", "body-sm: Next 400, 15 to 14", "Chest X-ray and graft ultrasound"],
  ["type-data", "data: Mono 400, 16 to 14", "HRN-2026-0147   Tue 22 Sep 2026"],
  ["type-label", "label: Next 700, 14 to 13", "Due soon"],
  ["type-caption", "caption: Next 400, 14 to 12", "Updated 8:02 AM"],
];
const LEVELS: [string, string, string][] = [
  ["clay-sunken", "--clay-sunken", "Tray wells, inputs, tracks"],
  ["clay-1 bg-surface-1", "--clay-1", "Buttons, avatars, stepper nodes"],
  ["clay-2 bg-surface-1", "--clay-2", "Cards, tray cells at rest"],
  ["clay-3 bg-surface-2", "--clay-3", "Hover, popovers, dialogs"],
  ["clay-pressed bg-surface-1", "--clay-pressed", "Active and selected"],
  ["clay-brick bg-brick text-on-brick", "--clay-brick", "Primary action"],
  ["bg-maroon text-on-brick [box-shadow:var(--clay-brick-pressed)]", "--clay-brick-pressed", "Primary pressed"],
  ["clay-disabled", "--clay-disabled", "Disabled"],
];
const RADII: [string, string][] = [
  ["rounded-xs", "xs 8"], ["rounded-sm", "sm 12"], ["rounded-md", "md 16"], ["rounded-lg", "lg 22"],
  ["rounded-xl", "xl 28"], ["rounded-2xl", "2xl 36"], ["rounded-full", "pill"],
];
const BTN_STATES: [string, Partial<ClayButtonProps>][] = [
  ["Rest", {}], ["Hover", { className: "is-hover" }], ["Pressed", { className: "is-active" }],
  ["Focus", { className: "is-focus" }], ["Disabled", { disabled: true }], ["Loading", { loading: true }],
];
const BUTTONS: [ClayButtonVariant, string, ReactNode?][] = [
  ["primary", "Enroll patient", <Plus {...I} />], ["secondary", "Send message", <Send {...I} />],
  ["ghost", "View all 5"], ["destructive", "Cancel appointment"], ["icon", "Refresh dashboard", <RefreshCw {...I} />],
];
const PATIENT_CHIPS: [ChipStatus, string][] = [
  ["overdue", "Past due"], ["due-soon", "Due soon"], ["planned", "Scheduled"], ["done", "Done"], ["filed", "Claim filed"],
  ["superseded", "Repeated"], ["lab-low", "Below range"], ["lab-high", "Above range"], ["lab-normal", "In range"], ["open", "Claim open"],
];
const TRAY: ClayCellProps[] = [
  { label: "Overdue services", value: 5, valueTone: "overdue", sub: "oldest 19 d", icon: <TriangleAlert {...I} />, status: <StatusChip status="overdue" /> },
  { label: "Claims due in 7 days", value: 4, valueTone: "due-soon", sub: "next Thu 1 Oct", icon: <FileClock {...I} />, status: <StatusChip status="due-soon" /> },
  { label: "Reschedule requests", value: 2, sub: "oldest 2 d", icon: <CalendarClock {...I} /> },
  { label: "Superseded, claim not filed", value: 1, sub: "deadline Mon 12 Oct", icon: <History {...I} /> },
  { label: "Active patients", value: 12, center: true, sub: "8 recipients, 4 donors", icon: <Users {...I} className="text-sage" /> },
  { label: "Due this week", value: 3, sub: "next Thu 1 Oct", status: <StatusChip status="planned" /> },
  { label: "Recipients, work-up", value: 4, sub: "4 stages" },
  { label: "Recipients, post-KT", value: 4, sub: "newest day 35" },
  { label: "Donors", value: 4, sub: "2 work-up, 2 post-donation" },
];
const RECIPIENT_STEPS = ["Orientation", "Phase 1", "Phase 2", "Clearances", "PhilHealth Z", "Phase 3", "Post-KT"];
const DONOR_STEPS = ["Orientation", "Phase 1", "Phase 2", "Clearances", "Phase 3", "Post-donation"];
const toSteps = (labels: string[]) => labels.map((label) => ({ id: label, label }));
const ROWS: [string, string, string, ChipStatus, string, string, string, boolean?][] = [
  ["X-ray and USD", "Chest X-ray and graft ultrasound", "Tue 22 Sep 2026", "overdue", "Overdue, 8 d", "Not set", ""],
  ["Laboratory", "Monthly panel", "Thu 1 Oct 2026", "due-soon", "Due soon", "Not set", ""],
  ["Meds claim", "Meds claim", "Fri 2 Oct 2026", "due-soon", "Due soon", "Mon 5 Oct 2026", "due-soon"],
  ["Laboratory", "Monthly panel", "Tue 1 Sep 2026", "superseded", "Superseded", "Mon 12 Oct 2026", "open", true],
];
const SECTIONS = [
  ["colors", "Color"], ["type", "Type"], ["elevation", "Elevation"], ["shape", "Shape"], ["buttons", "Buttons"],
  ["chips", "Status chips"], ["inputs", "Inputs"], ["avatars", "Avatars"], ["tray", "Nine-Cell Tray"], ["cards", "Cards"],
  ["stepper", "Stepper"], ["tabs", "Tabs"], ["progress", "Progress and skeleton"], ["table", "Flat table"],
];

function luminance(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a?: string, b?: string) {
  const la = a ? luminance(a) : null;
  const lb = b ? luminance(b) : null;
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function useTokens(names: string[]) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    setValues(Object.fromEntries(names.map((n) => [n, style.getPropertyValue(n).trim()])));
    // Token names are static for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return values;
}

function Ratio({ fg, bg, need, v }: { fg: string; bg: string; need: number; v: Record<string, string> }) {
  const r = contrast(v[fg], v[bg]);
  const verdict = need === 0 ? "decorative" : r === null ? "" : r >= need ? `passes ${need}` : `fails ${need}`;
  return (
    <span className="type-caption text-ink-muted">
      {fg.slice(2)} on {bg.slice(2)} <span className="font-mono text-ink">{r ? r.toFixed(2) : "--"}</span> {verdict}
    </span>
  );
}

function Swatch({ pair: [token, fg, bg, need, note], v }: { pair: Pair; v: Record<string, string> }) {
  return (
    <li className="flex items-center gap-3 rounded-md bg-surface-1 p-2 pr-3">
      <span aria-hidden className="clay-1 size-12 shrink-0 rounded-sm" style={{ background: `var(${token})` }} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="type-label text-ink">{token}</span>
        <span className="type-caption text-ink-muted">{note}</span>
        <Ratio fg={fg} bg={bg} need={need} v={v} />
      </span>
      <span className="type-data shrink-0 text-ink-muted">{v[token] || "--"}</span>
    </li>
  );
}

function Section({ id, title, lede, children }: { id: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-8 flex-col gap-5">
      <div>
        <h2 id={`${id}-h`} className="type-headline text-ink">{title}</h2>
        {lede ? <p className="type-body mt-1 max-w-[68ch] text-ink-muted">{lede}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Demo({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="type-label text-ink">{label}</h3>
      <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>
    </div>
  );
}

export default function DesignSystemPreview() {
  const v = useTokens(ALL_TOKENS);
  const [selected, setSelected] = useState(0);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    document.title = "Design system | KTP";
  }, []);
  const retry = () => {
    setRetrying(true);
    window.setTimeout(() => setRetrying(false), 1200);
  };

  return (
    <div data-surface="admin" className="min-h-dvh bg-ground text-ink">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-10 md:px-6 lg:px-8 lg:py-14">
        <header className="flex max-w-[68ch] flex-col items-start gap-3">
          <StatusChip status="info" label="Sample data" srDetail="fictional patients for preview only" title="Fictional patients for preview only. No real patient data." />
          <h1 className="type-display">KTP design system</h1>
          <p className="type-body-lg text-ink-muted">
            Sage putty ground, chalk clay, one brick action. Every value on this page is read from the live tokens in styles/clay.css.
          </p>
        </header>

        <div className="mt-10 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
          <nav aria-label="Style guide sections" className="hidden lg:block">
            <ul className="sticky top-8 flex flex-col">
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="type-body-sm flex min-h-11 items-center rounded-sm px-3 text-ink-muted hover:bg-sunken/60 hover:text-ink">{label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <main className="flex min-w-0 flex-col gap-(--section-gap)">
            <Section id="colors" title="Color" lede="Olive neutrals own the screen. Brick is for actions only. Status hues are reserved and always carry an icon and a word.">
              <Demo label="Neutrals and surfaces"><ul className="grid w-full gap-2 md:grid-cols-2 xl:grid-cols-3">{NEUTRALS.map((p) => <Swatch key={p[0]} pair={p} v={v} />)}</ul></Demo>
              <Demo label="Brand roles"><ul className="grid w-full gap-2 md:grid-cols-2 xl:grid-cols-3">{BRAND.map((p) => <Swatch key={p[0]} pair={p} v={v} />)}</ul></Demo>
              <Demo label="Status roles (fg on bg)">
                <ul className="grid w-full gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {STATUS.map(([status, fg, bg]) => (
                    <li key={status} className="flex flex-col items-start gap-1.5 rounded-md bg-surface-1 p-3">
                      <StatusChip status={status} />
                      <span className="type-data text-ink-muted">{v[fg]} on {bg === "--surface-1" ? "surface-1" : v[bg]}</span>
                      <Ratio fg={fg} bg={bg} need={4.5} v={v} />
                    </li>
                  ))}
                </ul>
              </Demo>
              <Demo label="Chart series (on surface-1, 3:1 for marks)">
                <ul className="grid w-full grid-cols-2 gap-2 md:grid-cols-5">
                  {SERIES.map((s, i) => (
                    <li key={s} className="flex flex-col gap-2 rounded-md bg-surface-1 p-3">
                      <span aria-hidden className="h-2 rounded-full" style={{ background: `var(${s})` }} />
                      <span className="type-label">Series {i + 1}</span>
                      <span className="type-data text-ink-muted">{v[s] || "--"}</span>
                      <Ratio fg={s} bg="--surface-1" need={3} v={v} />
                    </li>
                  ))}
                </ul>
              </Demo>
            </Section>

            <Section id="type" title="Type" lede="Gabarito for display, Atkinson Hyperlegible Next for reading, Atkinson Hyperlegible Mono for every number. Sizes are fluid from 320 to 1440.">
              <ul className="flex flex-col divide-y divide-hairline rounded-lg bg-surface-1 px-4 lg:px-6">
                {TYPE.map(([cls, spec, sample]) => (
                  <li key={cls} className="flex flex-col gap-1 py-4 md:flex-row md:items-baseline md:gap-6">
                    <span className="type-caption w-56 shrink-0 text-ink-muted">{spec}</span>
                    <span className={cn(cls, "min-w-0 break-words text-ink")}>{sample}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="elevation" title="Elevation" lede="Light from the top-left. Soft forest drop, white top-left highlight, tinted bottom-right shade. Hover fades the next level in on a layer; shadows never animate.">
              <ul className="grid grid-cols-2 gap-5 md:grid-cols-4">
                {LEVELS.map(([cls, token, use]) => (
                  <li key={token} className="flex flex-col gap-2">
                    <span aria-hidden className={cn("h-24 rounded-lg", cls)} />
                    <span className="type-label">{token}</span>
                    <span className="type-caption text-ink-muted">{use}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="shape" title="Shape" lede="Concentric: inner radius equals outer radius minus padding. Clay surfaces carry no borders.">
              <ul className="flex flex-wrap gap-4">
                {RADII.map(([cls, name]) => (
                  <li key={cls} className="flex flex-col items-center gap-2">
                    <span aria-hidden className={cn("clay-2 size-16 bg-surface-1", cls)} />
                    <span className="type-data text-ink-muted">{name}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="buttons" title="Buttons" lede="Heights 44, 48, 52. One primary per region. Hover and pressed are shown here with static demo classes.">
              {BUTTONS.map(([variant, label, icon]) => (
                <Demo key={variant} label={variant.charAt(0).toUpperCase() + variant.slice(1)} className="items-end gap-x-5 gap-y-4">
                  {BTN_STATES.map(([state, props]) => (
                    <div key={state} className="flex flex-col items-start gap-1.5">
                      <span className="type-caption text-ink-muted">{state}</span>
                      {variant === "icon" ? (
                        <ClayButton variant="icon" aria-label={label} {...props}>{icon}</ClayButton>
                      ) : (
                        <ClayButton variant={variant} icon={icon} {...props}>{label}</ClayButton>
                      )}
                    </div>
                  ))}
                </Demo>
              ))}
              <Demo label="Sizes: sm 44, md 48, lg 52">
                <ClayButton size="sm">Save result</ClayButton>
                <ClayButton size="md">Save result</ClayButton>
                <ClayButton size="lg" iconEnd={<ArrowRight {...I} />}>Confirm</ClayButton>
                <ClayButton variant="icon" size="lg" aria-label="Search"><Search {...I} /></ClayButton>
              </Demo>
            </Section>

            <Section id="chips" title="Status chips" lede="Flat pills. Word plus icon, never color alone. Admin 28 high, patient 32.">
              <Demo label="Admin labels">{STATUS.map(([s]) => <StatusChip key={s} status={s} />)}<StatusChip status="open" /><StatusChip status="done" label="Clear" /></Demo>
              <div data-surface="patient">
                <Demo label="Patient labels">{PATIENT_CHIPS.map(([s, label]) => <StatusChip key={label} status={s} label={label} size="patient" />)}</Demo>
              </div>
              <Demo label="Filter chips (level 1, pressed when on)">
                <StatusChip status="overdue" onClick={() => undefined} pressed />
                <StatusChip status="due-soon" onClick={() => undefined} pressed={false} />
                <StatusChip status="filed" onClick={() => undefined} pressed={false} className="is-focus" />
              </Demo>
            </Section>

            <Section id="inputs" title="Inputs" lede="Sunken well with a 1.5 px border, label above, helper and error below.">
              <div className="grid gap-6 md:grid-cols-2">
                <ClayInput label="Reason for change" hint="Required. Saved to History with the before and after values." placeholder="Example: typo in the value" />
                <ClayInput label="Date filed" defaultValue="Wed 30 Sep 2026" className="is-focus" hint="Focus state shown with a demo class." />
                <ClayInput label="Creatinine value" defaultValue="-4" inputMode="decimal" error="Enter a number of 0 or more." />
                <ClayInput label="Claim deadline" defaultValue="Not set" disabled hint="Set after the service is done." />
                <ClayInput label="Search patients" leading={<Search {...I} />} defaultValue="Villacorta" loading />
                <div data-surface="patient">
                  <ClayInput size="patient" label="Your note" placeholder="Example: I can come on Monday or Tuesday morning." hint="Required." />
                </div>
              </div>
            </Section>

            <Section id="avatars" title="Avatars" lede="Recipients in peach and maroon, donors in sage. A broken photo falls back to initials.">
              <Demo label="Sizes 32, 40, 56, 72">
                {([32, 40, 56, 72] as const).map((s) => <ClayAvatar key={s} size={s} kind="recipient" name="Villacorta, Analyn" />)}
              </Demo>
              <Demo label="Donor, neutral, photo error, loading, linked pair">
                <ClayAvatar size={56} kind="donor" name="Villacorta, Ramil" />
                <ClayAvatar size={56} name="Bautista-Galvez, Leonora" />
                <ClayAvatar size={56} kind="recipient" name="Serrano, Evangeline" src="/branding/cells/missing-photo.png" />
                <ClayAvatar size={56} name="Loading" loading decorative />
                <ClayAvatarPair size={56} recipient={{ name: "Villacorta, Analyn" }} donor={{ name: "Villacorta, Ramil" }} />
              </Demo>
            </Section>

            <Section id="tray" title="Nine-Cell Tray" lede="The signature. A sunken tray whose gutters are the logo grid lines. The center cell holds people, never an alarm. Arrow keys move between cells; select a cell to filter.">
              <ClayTray label="Triage counts, sample" className="max-w-[760px]">
                {TRAY.map((cell, i) => (
                  <ClayCell key={i} {...cell} selected={selected === i} aria-label={`${cell.label}, ${cell.value}. Show list.`} onClick={() => setSelected(i)} />
                ))}
              </ClayTray>
              <Demo label="Cell states" className="block">
                <ClayTray label="Cell states" reflow={false} roving={false} className="grid-cols-2 lg:grid-cols-4">
                  <ClayCell label="Rest" value={7} sub="oldest 12 d" />
                  <ClayCell label="Hover" value={7} className="is-hover" />
                  <ClayCell label="Pressed" value={7} className="is-active" />
                  <ClayCell label="Focus" value={7} className="is-focus" />
                  <ClayCell label="Selected" value={7} selected />
                  <ClayCell label="Zero" value={0} status={<StatusChip status="done" label="Clear" />} />
                  <ClayCell state="loading" />
                  <ClayCell state="error" label="Reschedule requests" onRetry={retry} />
                </ClayTray>
              </Demo>
              <div className="grid gap-8 md:grid-cols-2">
                <Demo label="Patient strip, 1x3 at every width" className="block">
                  <div data-surface="patient">
                    <ClayTray layout="1x3" label="Your summary, sample">
                      <ClayCell label="Due" value={3} sub="next Thu 1 Oct" />
                      <ClayCell label="Claims" value={2} sub="due soon" />
                      <ClayCell label="Messages" value={2} sub="new" />
                    </ClayTray>
                  </div>
                </Demo>
                <Demo label="Logo tray (sign-in): the mark sliced into its nine cells" className="block">
                  <ClayTray label="Organ Transplant Services mark" reflow={false} roving={false} className="max-w-[360px]">
                    {Array.from({ length: 9 }, (_, i) => (
                      <ClayCell key={i} as="div" center={i === 4} image={`/branding/cells/cell-${i + 1}.png`} />
                    ))}
                  </ClayTray>
                </Demo>
              </div>
              <Demo label="Loading tray">
                <ClayTray layout="1x3" label="Loading example" loading className="w-full max-w-[520px]" />
              </Demo>
            </Section>

            <Section id="cards" title="Cards" lede="Chalk clay at level 2. Rows inside stay flat.">
              <div className="grid gap-6 md:grid-cols-2">
                <ClayCard>
                  <ClayCardHeader title="Overdue services" description="Planned services past their due date." action={<ClayButton variant="ghost" size="sm">View all 5</ClayButton>} />
                  <ul className="divide-y divide-hairline">
                    {[["Dimaculangan, Rodel T.", "HRN-2025-0832", "19 d"], ["Abellera, Nestor Q.", "HRN-2026-0503", "15 d"], ["Serrano, Evangeline P.", "HRN-2024-0519", "9 d"]].map(([name, hrn, late]) => (
                      <li key={hrn} className="flex min-h-14 items-center justify-between gap-3 py-2">
                        <span className="min-w-0"><span className="type-body block truncate">{name}</span><span className="type-data text-ink-muted">{hrn}</span></span>
                        <StatusChip status="overdue" label={late} srContext="Overdue by" />
                      </li>
                    ))}
                  </ul>
                </ClayCard>
                <div className="flex flex-col gap-6">
                  <ClayCard asChild interactive className="is-hover">
                    <a href="#cards" className="flex items-center gap-4">
                      <ClayAvatar size={56} kind="recipient" name="Villacorta, Analyn" decorative />
                      <span className="min-w-0 flex-1"><span className="type-title block">Villacorta, Analyn F.</span><span className="type-data text-ink-muted">HRN-2026-0147 · Post-KT day 154</span></span>
                      <ArrowRight aria-hidden {...I} className="size-5 text-brick" />
                    </a>
                  </ClayCard>
                  <ClayCard>
                    <ClayCardHeader title="Patients by stage" />
                    <ClayCardEmpty message="No active patients yet." action={<ClayButton size="sm" icon={<Plus {...I} />}>Enroll patient</ClayButton>} />
                  </ClayCard>
                </div>
                <ClayCard>
                  <ClayCardHeader title="Claims due within 7 days" />
                  <ClaySkeletonGroup label="Loading dashboard..." className="flex flex-col gap-3">
                    <ClaySkeleton sheen className="h-12" /><ClaySkeleton sheen className="h-12" /><ClaySkeleton sheen className="h-12 w-2/3" />
                  </ClaySkeletonGroup>
                </ClayCard>
                <ClayCard>
                  <ClayCardHeader title="Reschedule requests" />
                  <ClayCardError message="Could not load this list." onRetry={retry} retrying={retrying} />
                </ClayCard>
              </div>
            </Section>

            <Section id="stepper" title="Stepper" lede="Sunken track, clay nodes. Full labels from 1024, dots and a summary line below.">
              <ClayStepper steps={toSteps(RECIPIENT_STEPS)} current={6} trailing="Post-KT day 154" />
              <ClayStepper steps={toSteps(DONOR_STEPS)} current={2} label="Donor stage progress" />
              <ClayStepper steps={[]} current={0} loading />
            </Section>

            <Section id="tabs" title="Tabs" lede="Sunken pill track. The active tab is a raised surface-2 pill. Arrow keys, Home, and End move focus.">
              <ClayTabs defaultValue="tracker">
                <ClayTabsList aria-label="Patient profile sections">
                  {["Tracker", "Labs", "Checklist", "Appointments", "Messages", "History"].map((t) => (
                    <ClayTabsTrigger key={t} value={t.toLowerCase()}>{t}</ClayTabsTrigger>
                  ))}
                </ClayTabsList>
                {["tracker", "labs", "checklist", "appointments", "messages", "history"].map((t) => (
                  <ClayTabsContent key={t} value={t} className="type-body text-ink-muted">Sample {t} panel.</ClayTabsContent>
                ))}
              </ClayTabs>
              <ClayTabs defaultValue="rest">
                <ClayTabsList aria-label="Tab states">
                  <ClayTabsTrigger value="rest">Active</ClayTabsTrigger>
                  <ClayTabsTrigger value="hover" className="is-hover">Hover</ClayTabsTrigger>
                  <ClayTabsTrigger value="focus" className="is-focus">Focus</ClayTabsTrigger>
                  <ClayTabsTrigger value="off" disabled>Disabled</ClayTabsTrigger>
                </ClayTabsList>
              </ClayTabs>
            </Section>

            <Section id="progress" title="Progress and skeleton" lede="Rings fill in sage-deep and turn Done green at 100%. Skeletons are sunken wells in the final geometry.">
              <Demo label="Progress ring 44, 64, 72, empty, loading, error" className="gap-6">
                <ProgressRing size={44} value={38} max={42} label="Work-up checklist" valueText="38 of 42 done" />
                <ProgressRing size={64} value={42} max={42} label="Work-up checklist" valueText="42 of 42 done" />
                <ProgressRing size={72} value={31} max={42} label="Work-up checklist" valueText="31 of 42 done" />
                <ProgressRing size={64} value={0} max={42} label="Work-up checklist" valueText="0 of 42 done" display="0/42" />
                <ProgressRing size={64} value={0} label="Work-up checklist" state="loading" />
                <ProgressRing size={64} value={0} label="Work-up checklist" state="error" />
              </Demo>
              <Demo label="Skeleton: static (patient) and sheen (admin)" className="grid w-full grid-cols-[auto_1fr] gap-3">
                <ClaySkeleton shape="circle" className="size-14" /><ClaySkeleton className="h-14" />
                <ClaySkeleton shape="circle" sheen className="size-14" /><ClaySkeleton sheen className="h-14" />
              </Demo>
            </Section>

            <Section id="table" title="Flat table" lede="Data stays flat: hairline rows, a 1.5 px header rule, sticky first column, Mono for dates. Superseded rows are struck through.">
              <div role="region" aria-label="Tracker table, sample" tabIndex={0} className="clay-table-wrap clay-focus">
                <table className="clay-table">
                  <thead>
                    <tr>{["Service", "Label", "Due date", "Status", "Claim deadline", "Claim"].map((h, i) => <th key={h} data-sticky={i === 0 || undefined} scope="col">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {ROWS.map(([service, label, due, status, statusLabel, deadline, claim, superseded], i) => (
                      <tr key={i} data-superseded={superseded || undefined} className={i === 1 ? "is-hover" : undefined}>
                        <th scope="row" data-sticky="true">{service}</th>
                        <td className={cn(superseded && "clay-struck")}>{label}</td>
                        <td data-num="true" className={cn(superseded && "clay-struck")}>{due}</td>
                        <td><StatusChip status={status} label={statusLabel} /></td>
                        <td data-num="true" className={deadline === "Not set" ? "text-ink-muted" : undefined}>{deadline}</td>
                        <td>{claim ? <StatusChip status={claim as ChipStatus} /> : <span className="text-ink-muted">No deadline</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </main>
        </div>
      </div>
    </div>
  );
}
