import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, type HTMLMotionProps } from "framer-motion";
import { useMotionPreset, V } from "@/lib/motion";

export interface PageTransitionProps extends Omit<HTMLMotionProps<"div">, "children"> {
  /** Changes on navigation, for example wouter's `useLocation()[0]`. */
  routeKey: string;
  /** Move focus to the new page's h1 after a navigation (never on first load). Default true. */
  focusHeading?: boolean;
  children: ReactNode;
}

/**
 * Route transition. Admin: exit opacity 0 and y -8 in 120 ms, then enter from y 16 on `page`.
 * Patient: enter from y 8 on `gentle`, exit is a 120 ms fade. Reduced motion: opacity only.
 *
 * With wouter, render the routes with an explicit location so the exiting page keeps its content:
 *   const [location] = useLocation();
 *   <PageTransition routeKey={location}><Switch location={location}>...</Switch></PageTransition>
 * Keep fixed layers (OrganGridBackdrop, the patient tab bar) outside: a transformed ancestor
 * would pin them to the page while it moves.
 */
export function PageTransition({ routeKey, focusHeading = true, children, ...rest }: PageTransitionProps) {
  const preset = useMotionPreset();
  const firstKey = useRef(routeKey);
  return (
    <AnimatePresence mode="wait" initial>
      <motion.div key={routeKey} variants={preset.page} initial={V.hidden} animate={V.show} exit={V.exit} {...rest}>
        <FocusHeading enabled={focusHeading && routeKey !== firstKey.current} />
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Focuses the nearest page h1 once on mount (route change), without scrolling. */
function FocusHeading({ enabled }: { enabled: boolean }) {
  const markerRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!enabled) return;
    const page = markerRef.current?.parentElement;
    const heading = page?.querySelector<HTMLElement>("h1");
    if (!heading) return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }, [enabled]);
  return <span ref={markerRef} hidden />;
}
