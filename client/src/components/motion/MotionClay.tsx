import { forwardRef, useMemo, type ComponentProps, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { ClayButton, ClayCard, ClayCell } from "@/components/clay";
import { useMotionPreset, V } from "@/lib/motion";
import { useSquish } from "./Squish";
import { useTilt } from "./Tilt3D";

/* Raw motion versions of the clay components (no defaults applied). */
export const MotionClayButtonBase = motion.create(ClayButton);
export const MotionClayCellBase = motion.create(ClayCell);
export const MotionClayCardBase = motion.create(ClayCard);

export type MotionClayButtonProps = ComponentProps<typeof MotionClayButtonBase>;

/**
 * ClayButton with the press squish and, for raised variants, the hover lift.
 * Admin: scaleX 1.03, scaleY 0.94 on `press`. Patient: scale 0.97 on `gentle`. Reduced: none.
 * Disabled and loading buttons do not squish.
 */
export const MotionClayButton = forwardRef<HTMLButtonElement, MotionClayButtonProps>(function MotionClayButton(
  { variant = "primary", disabled, loading, ...rest },
  ref,
) {
  const lift = variant === "primary" || variant === "secondary" || variant === "icon";
  const squish = useSquish("button", { lift, disabled: Boolean(disabled || loading) });
  return <MotionClayButtonBase ref={ref} variant={variant} disabled={disabled} loading={loading} {...squish} {...rest} />;
});

export type MotionClayCellProps = Omit<ComponentProps<typeof MotionClayCellBase>, "children"> & {
  children?: ReactNode;
  /** Pointer-follow tilt on admin surfaces (fine pointers only). Default true. */
  tilt?: boolean;
  /** Press squish (scale 0.97). Default true. */
  squish?: boolean;
};

/**
 * ClayCell with squish (0.97), hover lift, admin tilt with the moving highlight, and, inside a
 * StaggerTray, the staggered entrance. Static cells (as="div"), loading and error cells stay still.
 */
export const MotionClayCell = forwardRef<HTMLElement, MotionClayCellProps>(function MotionClayCell(
  {
    tilt = true,
    squish = true,
    style,
    children,
    onPointerEnter,
    onPointerMove,
    onPointerLeave,
    ...rest
  },
  ref,
) {
  const preset = useMotionPreset();
  const tag = rest.as ?? (rest.href ? "a" : "button");
  const interactive = tag !== "div" && !rest.disabled && (rest.state ?? "ready") === "ready";
  const press = useSquish("cell", { disabled: !interactive || !squish });
  const tiltApi = useTilt<HTMLElement>({ enabled: interactive && tilt, onPointerEnter, onPointerMove, onPointerLeave });

  // Cell variants only play when a parent (StaggerTray) drives "hidden" and "show".
  const center = Boolean(rest.center);
  const variants = useMemo(() => preset.cell(center), [preset, center]);

  return (
    <MotionClayCellBase
      ref={ref}
      variants={variants}
      {...press}
      {...tiltApi.handlers}
      style={{ ...style, ...tiltApi.style }}
      {...rest}
    >
      {children}
      {tiltApi.highlight}
    </MotionClayCellBase>
  );
});

/** Alias: the tray child that plays the staggered entrance. */
export const StaggerCell = MotionClayCell;

export type MotionClayCardProps = ComponentProps<typeof MotionClayCardBase>;

/**
 * ClayCard with a one-off entrance. When `interactive`, it also lifts on hover and squishes to 0.97.
 * Pass `entrance={false}` to skip the entrance (for example inside a StaggerList, which drives it).
 */
export const MotionClayCard = forwardRef<HTMLDivElement, MotionClayCardProps & { entrance?: boolean }>(
  function MotionClayCard({ entrance = true, interactive, ...rest }, ref) {
    const preset = useMotionPreset();
    const press = useSquish("cell", { disabled: !interactive });
    const play = entrance ? { variants: preset.entrance, initial: V.hidden, animate: V.show } : {};
    return <MotionClayCardBase ref={ref} interactive={interactive} {...play} {...press} {...rest} />;
  },
);

export type ToastMotionProps = HTMLMotionProps<"div">;

/**
 * Toast container motion. Render inside AnimatePresence with a key.
 * Admin: from y 24 and scale 0.96 on `pop`; exit opacity and y 8. Patient: y 16 on `gentle`.
 */
export const ToastMotion = forwardRef<HTMLDivElement, ToastMotionProps>(function ToastMotion(props, ref) {
  const preset = useMotionPreset();
  return <motion.div ref={ref} variants={preset.toast} initial={V.hidden} animate={V.show} exit={V.exit} {...props} />;
});
