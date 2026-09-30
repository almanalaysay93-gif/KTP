import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Info, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClayButton } from "./ClayButton";

export interface ClayCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Clay level: 1 list containers, 2 cards (default), 3 popovers and dialogs. */
  level?: 1 | 2 | 3;
  surface?: 1 | 2;
  /** The whole card is a link target: adds the hover layer and pressed state. Pair with asChild. */
  interactive?: boolean;
  padding?: "default" | "none";
  asChild?: boolean;
}

const LEVELS = { 1: "clay-1", 2: "clay-2", 3: "clay-3" } as const;

export const ClayCard = React.forwardRef<HTMLDivElement, ClayCardProps>(function ClayCard(
  { level = 2, surface = 1, interactive = false, padding = "default", asChild = false, className, ...rest },
  ref,
) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      ref={ref}
      data-slot="clay-card"
      className={cn(
        "block rounded-lg text-ink lg:rounded-xl",
        surface === 1 ? "bg-surface-1" : "bg-surface-2",
        LEVELS[level],
        padding === "default" && "p-(--card-pad)",
        interactive && "clay-hover clay-press clay-focus no-underline",
        className,
      )}
      {...rest}
    />
  );
});

export interface ClayCardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional ghost action, top-right. */
  action?: React.ReactNode;
  titleAs?: "h2" | "h3" | "h4";
}

export const ClayCardHeader = React.forwardRef<HTMLDivElement, ClayCardHeaderProps>(function ClayCardHeader(
  { title, description, action, titleAs: Title = "h3", className, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cn("mb-3 flex items-start justify-between gap-3", className)} {...rest}>
      <div className="min-w-0">
        <Title className="type-title text-ink">{title}</Title>
        {description ? <p className="type-body-sm mt-1 text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="-my-1 shrink-0">{action}</div> : null}
    </div>
  );
});

export interface ClayCardEmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** One sentence. No illustration. */
  message: React.ReactNode;
  action?: React.ReactNode;
}

/** Empty state: a sunken well with one sentence and one action. */
export const ClayCardEmpty = React.forwardRef<HTMLDivElement, ClayCardEmptyProps>(function ClayCardEmpty(
  { message, action, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("clay-sunken flex flex-col items-start gap-3 rounded-md p-4 lg:p-5", className)}
      {...rest}
    >
      <p className="type-body text-ink">{message}</p>
      {action}
    </div>
  );
});

export interface ClayCardErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  message: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
}

/** Error state: an Info bar with Retry. */
export const ClayCardError = React.forwardRef<HTMLDivElement, ClayCardErrorProps>(function ClayCardError(
  { message, onRetry, retryLabel = "Retry", retrying = false, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      role="alert"
      className={cn("flex flex-wrap items-center gap-3 rounded-md bg-info-bg px-4 py-3 text-info", className)}
      {...rest}
    >
      <Info aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
      <p className="type-body min-w-0 flex-1">{message}</p>
      {onRetry ? (
        <ClayButton
          variant="ghost"
          size="sm"
          loading={retrying}
          icon={<RotateCw strokeWidth={1.75} />}
          onClick={onRetry}
          className="text-info"
        >
          {retryLabel}
        </ClayButton>
      ) : null}
    </div>
  );
});
