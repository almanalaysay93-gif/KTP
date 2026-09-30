import { Children, forwardRef, isValidElement, useMemo, type ComponentProps, type ReactNode, type Ref } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { ClayTray, type ClayTrayProps } from "@/components/clay";
import { useMotionPreset, V } from "@/lib/motion";

/** ClayTray's `layout` prop collides with framer's `layout`, so the motion version takes `trayLayout`. */
const TrayForMotion = forwardRef<HTMLDivElement, Omit<ClayTrayProps, "layout"> & { trayLayout?: ClayTrayProps["layout"] }>(
  function TrayForMotion({ trayLayout, ...rest }, ref) {
    return <ClayTray ref={ref} layout={trayLayout} {...rest} />;
  },
);
const MotionTray = motion.create(TrayForMotion);

type Trigger = "mount" | "inView";

function playProps(trigger: Trigger, amount: number) {
  return trigger === "inView" ? { whileInView: V.show, viewport: { once: true, amount } } : { animate: V.show };
}

export type StaggerTrayProps = Omit<ComponentProps<typeof MotionTray>, "trayLayout" | "layout" | "children"> & {
  /** ClayTray layout: "3x3" (the Nine-Cell Tray) or "1x3" (the patient strip). */
  layout?: ClayTrayProps["layout"];
  /** "mount" (default) plays on first render; "inView" waits until the tray scrolls into view (once). */
  trigger?: Trigger;
  /** Child index of the center cell. Defaults to the child whose `center` prop is true. */
  centerIndex?: number;
  children?: ReactNode;
};

/**
 * ClayTray with the signature entrance. Admin: the well fades in from scale 0.98, cells rise
 * from y 16 and scale 0.92 on `pop`, 45 ms apart in row-major order, center cell last with a
 * 1.04 overshoot. Patient: 60 ms apart on `gentle`, no overshoot. Reduced motion: a 150 ms fade.
 * Every child must be a motion cell (MotionClayCell or StaggerItem) so the stagger index matches
 * the DOM order; cells stay direct grid children, so reflow and roving focus keep working.
 */
export const StaggerTray = forwardRef<HTMLDivElement, StaggerTrayProps>(function StaggerTray(
  { trigger = "mount", centerIndex, layout, children, ...rest },
  ref,
) {
  const preset = useMotionPreset();
  const center =
    centerIndex ??
    Children.toArray(children).findIndex(
      (child) => isValidElement<{ center?: boolean }>(child) && child.props.center === true,
    );
  const variants = useMemo(() => preset.tray(center), [preset, center]);
  return (
    <MotionTray ref={ref} trayLayout={layout} variants={variants} initial={V.hidden} {...playProps(trigger, 0.3)} {...rest}>
      {children}
    </MotionTray>
  );
});

export interface StaggerListProps extends HTMLMotionProps<"div"> {
  as?: "div" | "ul" | "ol";
  trigger?: Trigger;
}

/** Generic staggered container (45 ms admin, 60 ms patient). Children: StaggerItem. */
export const StaggerList = forwardRef<HTMLElement, StaggerListProps>(function StaggerList(
  { as = "div", trigger = "mount", ...rest },
  ref,
) {
  const preset = useMotionPreset();
  // The three tags share one prop shape; the cast only narrows the ref type.
  const Comp = (as === "ul" ? motion.ul : as === "ol" ? motion.ol : motion.div) as typeof motion.div;
  return (
    <Comp ref={ref as Ref<HTMLDivElement>} variants={preset.list} initial={V.hidden} {...playProps(trigger, 0.2)} {...rest} />
  );
});

export interface StaggerItemProps extends HTMLMotionProps<"div"> {
  as?: "div" | "li";
  /** Inside a StaggerTray: use the tray cell entrance (center adds the admin overshoot). */
  cell?: boolean;
  center?: boolean;
}

/** One staggered child of a StaggerList (or, with `cell`, of a StaggerTray). */
export const StaggerItem = forwardRef<HTMLElement, StaggerItemProps>(function StaggerItem(
  { as = "div", cell = false, center = false, ...rest },
  ref,
) {
  const preset = useMotionPreset();
  const variants = useMemo(() => (cell ? preset.cell(center) : preset.listItem), [preset, cell, center]);
  const Comp = (as === "li" ? motion.li : motion.div) as typeof motion.div;
  return <Comp ref={ref as Ref<HTMLDivElement>} variants={variants} {...rest} />;
});

export interface EntranceProps extends HTMLMotionProps<"div"> {
  trigger?: Trigger;
}

/** A single entrance for one block (the patient next-up card, the triage panel). */
export const Entrance = forwardRef<HTMLDivElement, EntranceProps>(function Entrance({ trigger = "mount", ...rest }, ref) {
  const preset = useMotionPreset();
  return <motion.div ref={ref} variants={preset.entrance} initial={V.hidden} {...playProps(trigger, 0.3)} {...rest} />;
});
