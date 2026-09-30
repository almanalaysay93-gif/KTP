import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export type ClayButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "icon";
export type ClayButtonSize = "sm" | "md" | "lg";

export interface ClayButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ClayButtonVariant;
  /** sm 44, md 48, lg 52 (patient and sign-in). Icon buttons are square at the same heights. */
  size?: ClayButtonSize;
  /** Replaces the icon with an indeterminate ring, sets aria-busy, blocks clicks, keeps the label width. */
  loading?: boolean;
  /** Leading icon (lucide, 20 px). */
  icon?: React.ReactNode;
  iconEnd?: React.ReactNode;
  /** Render the single child (for example a wouter Link) with button styling. */
  asChild?: boolean;
}

const BASE =
  "clay-focus clay-press relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md type-button no-underline transition-colors duration-(--dur-color) [&_svg]:size-5 [&_svg]:shrink-0";

const VARIANTS: Record<ClayButtonVariant, string> = {
  primary:
    "clay-brick bg-brick text-on-brick hover:bg-brick-hover [&.is-hover]:bg-brick-hover active:bg-maroon [&.is-active]:bg-maroon",
  secondary: "clay-1 clay-hover bg-surface-2 text-ink",
  ghost:
    "clay-ghost bg-transparent text-ink hover:bg-sunken/60 [&.is-hover]:bg-sunken/60 active:bg-sunken/60 [&.is-active]:bg-sunken/60",
  destructive:
    "clay-ghost bg-transparent text-overdue hover:bg-sunken/60 [&.is-hover]:bg-sunken/60 active:bg-sunken/60 [&.is-active]:bg-sunken/60",
  icon: "clay-1 clay-hover bg-surface-2 text-ink",
};

const SIZES: Record<ClayButtonSize, string> = {
  sm: "h-11 px-4",
  md: "h-12 px-5",
  lg: "h-13 px-6",
};

const ICON_SIZES: Record<ClayButtonSize, string> = {
  sm: "size-11",
  md: "size-12",
  lg: "size-13",
};

/** 16 px indeterminate ring. Static under reduced motion. */
export function ClaySpinner({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex size-5 items-center justify-center", className)}>
      <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
    </span>
  );
}

export const ClayButton = React.forwardRef<HTMLButtonElement, ClayButtonProps>(function ClayButton(
  {
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    iconEnd,
    asChild = false,
    className,
    children,
    disabled,
    onClick,
    type,
    ...rest
  },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  const isIcon = variant === "icon";
  // asChild keeps aria-busy only: Slot needs the child element untouched.
  const showRing = loading && !asChild;
  // With no icon slot, the ring overlays the label so the width never changes.
  const overlaySpinner = showRing && !isIcon && !icon;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      data-variant={variant}
      data-size={size}
      disabled={asChild ? undefined : disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || (asChild && disabled) || undefined}
      onClick={handleClick}
      className={cn(BASE, VARIANTS[variant], isIcon ? ICON_SIZES[size] : SIZES[size], className)}
      {...rest}
    >
      {!isIcon && icon ? showRing ? <ClaySpinner /> : <span className="inline-flex">{icon}</span> : null}
      {isIcon && showRing ? (
        <ClaySpinner />
      ) : (
        <Slottable>
          {overlaySpinner ? <span className="opacity-0">{children}</span> : children}
        </Slottable>
      )}
      {overlaySpinner ? <ClaySpinner className="absolute inset-0 m-auto" /> : null}
      {iconEnd && !isIcon ? <span className="inline-flex">{iconEnd}</span> : null}
    </Comp>
  );
});
