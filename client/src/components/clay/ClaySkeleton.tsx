import * as React from "react";
import { cn } from "@/lib/utils";

export interface ClaySkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** rect uses r-md; pass a rounded-* class to match the target geometry. */
  shape?: "rect" | "pill" | "circle";
  /** Peach sheen sweep, admin surfaces only. Patient skeletons stay static. Off under reduced motion. */
  sheen?: boolean;
}

/** Sunken well matching the final geometry. Always hidden from screen readers; wrap in ClaySkeletonGroup. */
export const ClaySkeleton = React.forwardRef<HTMLDivElement, ClaySkeletonProps>(function ClaySkeleton(
  { shape = "rect", sheen = false, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      aria-hidden
      data-sheen={sheen || undefined}
      className={cn(
        "clay-skeleton clay-sunken",
        shape === "rect" ? "rounded-md" : "rounded-full",
        shape === "circle" && "aspect-square",
        className,
      )}
      {...rest}
    />
  );
});

export interface ClaySkeletonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Screen-reader text, for example "Loading dashboard..." */
  label?: string;
}

/** Busy region: aria-busy plus an sr-only label, around skeleton wells. */
export const ClaySkeletonGroup = React.forwardRef<HTMLDivElement, ClaySkeletonGroupProps>(function ClaySkeletonGroup(
  { label = "Loading", className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} aria-busy="true" className={className} {...rest}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
});
