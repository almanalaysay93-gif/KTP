import * as React from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClayButton } from "./ClayButton";

export type ClayCellTone = "ink" | "muted" | "overdue" | "due-soon" | "sage";
export type ClayCellState = "ready" | "loading" | "error";

export interface ClayCellProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /** Cell label (title role), top-left. */
  label?: React.ReactNode;
  /** Main count or date, set in the Mono numeral-xl role. */
  value?: React.ReactNode;
  unit?: React.ReactNode;
  /** Numeral color. Defaults: center cell sage, zero muted, otherwise ink. */
  valueTone?: ClayCellTone;
  /** One line under the value, for example "oldest 19 d". */
  sub?: React.ReactNode;
  /** Slot for a StatusChip. */
  status?: React.ReactNode;
  /** Icon, top-right (lucide 20 px). Hidden from screen readers. */
  icon?: React.ReactNode;
  /** Sliced logo-cell image (client/public/branding/cells/cell-N.png). Fills the cell. */
  image?: string;
  imageAlt?: string;
  /** Center Cell Rule: people only, sage tint, spans both columns when the tray reflows. */
  center?: boolean;
  /** Selected filter: pressed, peach tint, brick bar. Sets aria-pressed on buttons. */
  selected?: boolean;
  state?: ClayCellState;
  errorText?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  /** Element to render. Defaults to "a" with href, else "button". Use "div" for static cells. */
  as?: "button" | "a" | "div";
  href?: string;
  target?: string;
  rel?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  children?: React.ReactNode;
}

const TONES: Record<ClayCellTone, string> = {
  ink: "text-ink",
  muted: "text-ink-muted",
  overdue: "text-overdue",
  "due-soon": "text-due-soon",
  sage: "text-sage-deep",
};

function isZero(value: React.ReactNode) {
  return value === 0 || value === "0";
}

export const ClayCell = React.forwardRef<HTMLElement, ClayCellProps>(function ClayCell(
  {
    label,
    value,
    unit,
    valueTone,
    sub,
    status,
    icon,
    image,
    imageAlt = "",
    center = false,
    selected,
    state = "ready",
    errorText = "Could not load",
    onRetry,
    retryLabel = "Retry",
    as,
    href,
    disabled,
    type,
    className,
    children,
    ...rest
  },
  ref,
) {
  const shared = {
    "data-center": center || undefined,
    "data-media": image ? true : undefined,
  };

  if (state === "loading") {
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        aria-hidden
        data-state="loading"
        {...shared}
        className={cn("clay-cell", className)}
      />
    );
  }

  const tone = valueTone ?? (center ? "sage" : isZero(value) ? "muted" : "ink");
  const head =
    label || icon ? (
      <span className="clay-cell__head">
        {label ? <span className="type-title min-w-0">{label}</span> : <span />}
        {icon ? (
          <span aria-hidden className="clay-cell__icon [&_svg]:size-5">
            {icon}
          </span>
        ) : null}
      </span>
    ) : null;

  if (state === "error") {
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        role="group"
        data-state="error"
        {...shared}
        className={cn("clay-cell", className)}
        {...rest}
      >
        {head}
        <span className="clay-cell__value">
          <span aria-hidden className="type-numeral-xl text-ink-muted">
            --
          </span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="type-body-sm text-ink-muted">{errorText}</span>
          {onRetry ? (
            <ClayButton variant="icon" size="sm" aria-label={retryLabel} onClick={onRetry}>
              <RotateCw strokeWidth={1.75} />
            </ClayButton>
          ) : null}
        </span>
      </div>
    );
  }

  const Tag = as ?? (href ? "a" : "button");
  const interactive = Tag !== "div";
  const tagProps: Record<string, unknown> = {};
  if (Tag === "a") tagProps.href = href;
  if (Tag === "button") {
    tagProps.type = type ?? "button";
    tagProps.disabled = disabled;
    if (selected !== undefined) tagProps["aria-pressed"] = selected;
  }

  const content = (
    <>
      {image ? (
        <span className="clay-cell__media">
          <img src={image} alt={imageAlt} decoding="async" draggable={false} />
        </span>
      ) : null}
      {head}
      {value !== undefined ? (
        <span className="clay-cell__value">
          <span className={cn("type-numeral-xl", TONES[tone])}>{value}</span>
          {unit ? <span className="type-body-sm text-ink-muted">{unit}</span> : null}
        </span>
      ) : null}
      {sub ? <span className="type-body-sm text-ink-muted">{sub}</span> : null}
      {status ? <span className="mt-1 flex flex-wrap gap-1.5">{status}</span> : null}
      {children}
      {selected ? <span aria-hidden data-slot="cell-bar" className="clay-cell-bar" /> : null}
    </>
  );

  return React.createElement(
    Tag,
    {
      ref,
      ...rest,
      ...tagProps,
      ...shared,
      "data-selected": selected || undefined,
      "data-tray-cell": interactive || undefined,
      className: cn("clay-cell", interactive && "clay-hover clay-press clay-focus cursor-pointer", className),
    },
    content,
  );
});
