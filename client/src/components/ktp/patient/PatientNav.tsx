import { useMemo, useSyncExternalStore, type MouseEvent } from "react";
import { CalendarDays, FlaskConical, House, ListChecks, MessageSquare, type LucideIcon } from "lucide-react";
import { PILL_IDS, SHARED_PILL_HOST, SharedPill } from "@/components/motion";
import { cn } from "@/lib/utils";

export type PatientTabId = "home" | "labs" | "checklist" | "calendar" | "messages";

export interface PatientTab {
  id: PatientTabId;
  label: string;
  Icon: LucideIcon;
  /** Real route. Without it the item renders a button and calls onNavigate. */
  href?: string;
  /** No preview route yet: screen readers hear "preview only". */
  previewOnly?: boolean;
}

export const PATIENT_TABS: PatientTab[] = [
  { id: "home", label: "Home", Icon: House },
  { id: "labs", label: "Labs", Icon: FlaskConical },
  { id: "checklist", label: "Checklist", Icon: ListChecks },
  { id: "calendar", label: "Calendar", Icon: CalendarDays },
  { id: "messages", label: "Messages", Icon: MessageSquare },
];

export interface PatientNavProps {
  tabs?: PatientTab[];
  active: PatientTabId;
  onNavigate?: (id: PatientTabId) => void;
  /** Unread count on Messages: ink badge, peach Mono numeral. */
  unread?: number;
}

/* Media query as an external store, so the right nav renders on the first client frame. */
function subscribe(query: string) {
  return (onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  };
}
export function useMediaQuery(query: string): boolean {
  const sub = useMemo(() => subscribe(query), [query]);
  return useSyncExternalStore(
    sub,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function itemProps(tab: PatientTab, active: boolean, onNavigate?: (id: PatientTabId) => void) {
  const onClick = (event: MouseEvent) => {
    if (!onNavigate) return;
    event.preventDefault();
    onNavigate(tab.id);
  };
  return {
    "aria-current": active ? ("page" as const) : undefined,
    title: tab.previewOnly ? "Preview only" : undefined,
    onClick,
  };
}

function Label({ tab, unread }: { tab: PatientTab; unread?: number }) {
  return (
    <>
      {tab.label}
      {tab.id === "messages" && unread ? <span className="sr-only">, {unread} new</span> : null}
      {tab.previewOnly ? <span className="sr-only">, preview only</span> : null}
    </>
  );
}

function UnreadBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 font-mono text-sm font-semibold leading-none text-peach tabular-nums",
        className,
      )}
    >
      {count}
    </span>
  );
}

/**
 * Floating bottom tab bar, phones and tablets (DESIGN.md Components): slab inset 12 from the sides
 * and bottom plus the safe area, h 64, surface-2 at clay-2, radius xl. The active pill
 * (`tabbar-pill`) slides between items on `gentle`; under reduced motion it jumps.
 */
export function BottomTabBar({ tabs = PATIENT_TABS, active, onNavigate, unread }: PatientNavProps) {
  return (
    <nav
      aria-label="Main menu"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[520px] min-[360px]:inset-x-3 min-[360px]:bottom-[calc(12px+env(safe-area-inset-bottom))] print:hidden"
    >
      {/* Under 360 the slab docks full width (radius on top only) so every label keeps 14 px. */}
      <ul className="clay-2 grid h-[calc(64px+env(safe-area-inset-bottom))] grid-cols-5 rounded-t-xl bg-surface-2 p-0.5 pb-[calc(4px+env(safe-area-inset-bottom))] min-[360px]:h-16 min-[360px]:rounded-xl min-[360px]:p-1.5">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const Tag = tab.href ? "a" : "button";
          return (
            <li key={tab.id} className="min-w-0">
              <Tag
                {...(tab.href ? { href: tab.href } : { type: "button" as const })}
                {...itemProps(tab, isActive, onNavigate)}
                className={cn(
                  SHARED_PILL_HOST,
                  "clay-focus flex size-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-0 no-underline transition-colors duration-(--dur-color)",
                  isActive ? "text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {isActive ? <SharedPill id={PILL_IDS.tabbar} surface={1} style={{ borderRadius: 18 }} /> : null}
                <span className="relative inline-flex">
                  <tab.Icon aria-hidden className="size-6" strokeWidth={1.75} />
                  {tab.id === "messages" && unread ? <UnreadBadge count={unread} className="absolute -right-3.5 -top-2" /> : null}
                </span>
                <span className="max-w-full truncate font-sans text-sm font-semibold leading-4 max-[359px]:tracking-[-0.02em]">

                  <Label tab={tab} unread={unread} />
                </span>
              </Tag>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Top pill nav at 1024 and up: a sunken pill track, h 44, with the same `tabbar-pill` (only one of
 * the two navs is ever mounted, so the layoutId never collides).
 */
export function TopPillNav({ tabs = PATIENT_TABS, active, onNavigate, unread }: PatientNavProps) {
  return (
    <nav aria-label="Main menu" className="min-w-0">
      <ul className="clay-sunken flex h-13 items-center gap-1 rounded-full p-1">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const Tag = tab.href ? "a" : "button";
          return (
            <li key={tab.id} className="h-full">
              <Tag
                {...(tab.href ? { href: tab.href } : { type: "button" as const })}
                {...itemProps(tab, isActive, onNavigate)}
                className={cn(
                  SHARED_PILL_HOST,
                  "clay-focus type-button flex h-full cursor-pointer items-center gap-2 rounded-full px-4 no-underline transition-colors duration-(--dur-color)",
                  isActive ? "text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {isActive ? <SharedPill id={PILL_IDS.tabbar} surface={2} /> : null}
                <tab.Icon aria-hidden className="size-5" strokeWidth={1.75} />
                <span>
                  <Label tab={tab} unread={unread} />
                </span>
                {tab.id === "messages" && unread ? <UnreadBadge count={unread} /> : null}
              </Tag>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
