import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  CircleCheck,
  Clock,
  FileCheck2,
  History,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ChipStatus =
  | "overdue"
  | "due-soon"
  | "planned"
  | "open"
  | "upcoming"
  | "done"
  | "filed"
  | "superseded"
  | "lab-low"
  | "lab-high"
  | "lab-normal"
  | "info";

const HOLLOW = "border-[1.5px] border-dashed border-line-strong bg-transparent text-planned";

/** Admin labels from COPY.md section 5. Patient surfaces pass their own label. */
export const CHIP_STATUS: Record<ChipStatus, { label: string; Icon: LucideIcon; tone: string }> = {
  overdue: { label: "Overdue", Icon: TriangleAlert, tone: "bg-overdue-bg text-overdue" },
  "due-soon": { label: "Due soon", Icon: Clock, tone: "bg-due-soon-bg text-due-soon" },
  planned: { label: "Planned", Icon: CalendarClock, tone: HOLLOW },
  open: { label: "Open", Icon: CalendarClock, tone: HOLLOW },
  upcoming: { label: "Upcoming", Icon: CalendarClock, tone: HOLLOW },
  done: { label: "Done", Icon: CircleCheck, tone: "bg-done-bg text-done" },
  filed: { label: "Filed", Icon: FileCheck2, tone: "bg-filed-bg text-filed" },
  superseded: { label: "Superseded", Icon: History, tone: "bg-superseded-bg text-superseded" },
  "lab-low": { label: "Low", Icon: ArrowDown, tone: "bg-lab-low-bg text-lab-low" },
  "lab-high": { label: "High", Icon: ArrowUp, tone: "bg-lab-high-bg text-lab-high" },
  "lab-normal": { label: "Normal", Icon: Check, tone: "bg-lab-normal-bg text-lab-normal" },
  info: { label: "Info", Icon: Info, tone: "bg-info-bg text-info" },
};

export interface StatusChipProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  status: ChipStatus;
  /** Visible word. Defaults to the admin label. */
  label?: React.ReactNode;
  /** Screen-reader prefix, for example "Claim status:". */
  srContext?: string;
  /** Screen-reader suffix, for example "3 days". */
  srDetail?: string;
  /** admin h28, patient h32 */
  size?: "admin" | "patient";
  /** Filter chips only: renders a button with clay level 1 and aria-pressed. */
  onClick?: React.MouseEventHandler<HTMLElement>;
  pressed?: boolean;
}

export const StatusChip = React.forwardRef<HTMLElement, StatusChipProps>(function StatusChip(
  { status, label, srContext, srDetail, size = "admin", onClick, pressed, className, ...rest },
  ref,
) {
  const { label: fallback, Icon, tone } = CHIP_STATUS[status];
  const isFilter = typeof onClick === "function";
  const classes = cn(
    "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 type-label",
    size === "patient" ? "h-8" : "h-7",
    tone,
    isFilter &&
      "clay-1 clay-hover clay-press clay-focus cursor-pointer before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']",
    isFilter && pressed && "clay-pressed",
    className,
  );
  const body = (
    <>
      {srContext ? <span className="sr-only">{srContext} </span> : null}
      <Icon aria-hidden className={size === "patient" ? "size-4" : "size-3.5"} strokeWidth={1.75} />
      <span>{label ?? fallback}</span>
      {srDetail ? <span className="sr-only">, {srDetail}</span> : null}
    </>
  );

  if (isFilter) {
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        aria-pressed={pressed ?? false}
        data-status={status}
        onClick={onClick}
        className={classes}
        {...rest}
      >
        {body}
      </button>
    );
  }
  return (
    <span ref={ref as React.Ref<HTMLSpanElement>} data-status={status} className={classes} {...rest}>
      {body}
    </span>
  );
});
