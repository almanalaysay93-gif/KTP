import { motion, type HTMLMotionProps } from "framer-motion";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** layoutId names from DESIGN.md. Wrap each independent group in <LayoutGroup id="..."> if a page has two. */
export const PILL_IDS = {
  /** Admin and profile tabs. */
  tab: "tab-pill",
  /** Admin sidebar active item. */
  nav: "nav-pill",
  /** Patient floating tab bar. */
  tabbar: "tabbar-pill",
  /** Selected tray cell bar, morphing between cells and into the triage panel header. */
  triage: "triage",
} as const;

export type PillId = (typeof PILL_IDS)[keyof typeof PILL_IDS] | (string & {});

/**
 * Classes for the element that hosts a SharedPill (a ClayTabsTrigger, a nav link, a tab bar item):
 * it becomes the positioning and stacking context, and its own active fill and shadow are cleared
 * so only the moving pill draws the raised state.
 */
export const SHARED_PILL_HOST =
  "relative isolate data-[state=active]:bg-transparent data-[state=active]:shadow-none aria-[current=page]:bg-transparent aria-[current=page]:shadow-none";

export interface SharedPillProps extends Omit<HTMLMotionProps<"span">, "layoutId"> {
  id: PillId;
  /** Pill fill: 2 = surface-2 (tabs), 1 = surface-1 (sidebar, tab bar). */
  surface?: 1 | 2;
}

/**
 * The raised active pill that slides between items with a shared layout (`layout` spring on admin,
 * `gentle` on patient). Render it only inside the active item. Reduced motion: it jumps.
 */
export function SharedPill({ id, surface = 2, className, style, ...rest }: SharedPillProps) {
  const preset = useMotionPreset();
  return (
    <motion.span
      aria-hidden
      layoutId={id}
      transition={preset.layout}
      className={cn(
        "clay-1 pointer-events-none absolute inset-0 -z-10",
        surface === 2 ? "bg-surface-2" : "bg-surface-1",
        className,
      )}
      // Inline radius so framer corrects it while the pill scales between items of different widths.
      style={{ borderRadius: 999, ...style }}
      {...rest}
    />
  );
}

export interface SharedCellBarProps extends Omit<HTMLMotionProps<"span">, "layoutId"> {
  id?: PillId;
}

/**
 * The selected-cell bar (4 x 32 brick) as a shared layout element. Put it in the selected
 * MotionClayCell's children and in the triage panel header: it hides the cell's built-in bar and
 * morphs between them.
 */
export function SharedCellBar({ id = PILL_IDS.triage, className, style, ...rest }: SharedCellBarProps) {
  const preset = useMotionPreset();
  return (
    <motion.span
      aria-hidden
      data-shared-bar=""
      layoutId={id}
      transition={preset.layout}
      className={cn("clay-cell-bar pointer-events-none", className)}
      style={{ borderRadius: 999, ...style }}
      {...rest}
    />
  );
}
