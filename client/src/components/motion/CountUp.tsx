import { useCallback, useEffect, useLayoutEffect, useRef, type HTMLAttributes } from "react";
import { animate, useInView } from "framer-motion";
import { DURATION, EASE, useMotionMode } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface CountUpProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  value: number;
  /** Fraction digits (0 by default). Ignored when `format` is given. */
  decimals?: number;
  /** Custom formatter for each frame and the final value. */
  format?: (value: number) => string;
  /** Seconds. 0.7 by default (DESIGN.md). */
  duration?: number;
  /** Digit alignment inside the reserved width: "start" for left-aligned cells, "end" for table columns. */
  align?: "start" | "end";
}

/**
 * Count-up numeral, admin only: 0 to `value` over 700 ms ease-out the first time it is in view.
 * Patient surfaces and reduced motion render the final value immediately.
 * The width is reserved by an invisible copy of the final value and digits are tabular, so the
 * layout never shifts. Screen readers get the final value only: the ticking node is aria-hidden.
 * Frames write textContent directly; React does not re-render per frame.
 */
export function CountUp({
  value,
  decimals = 0,
  format,
  duration = DURATION.countUp,
  align = "start",
  className,
  ...rest
}: CountUpProps) {
  const mode = useMotionMode();
  const rootRef = useRef<HTMLSpanElement>(null);
  const tickRef = useRef<HTMLSpanElement>(null);
  const doneRef = useRef(false);
  const inView = useInView(rootRef, { once: true, amount: 0.5 });
  const shouldCount = mode === "full";

  const fmt = useCallback(
    (n: number) =>
      format
        ? format(n)
        : n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    [format, decimals],
  );
  const finalText = fmt(value);

  // Paint the right starting text before the first frame (no flash of the final value).
  useLayoutEffect(() => {
    const node = tickRef.current;
    if (!node) return;
    node.textContent = shouldCount && !doneRef.current ? fmt(0) : finalText;
  }, [shouldCount, finalText, fmt]);

  useEffect(() => {
    const node = tickRef.current;
    if (!node || !shouldCount || doneRef.current || !inView) return;
    const controls = animate(0, value, {
      duration,
      ease: EASE.out,
      onUpdate: (latest) => {
        node.textContent = fmt(decimals > 0 || format ? latest : Math.round(latest));
      },
      onComplete: () => {
        doneRef.current = true;
        node.textContent = finalText;
      },
    });
    // Text on interruption is owned by the layout effect above.
    return () => controls.stop();
  }, [inView, shouldCount, value, duration, fmt, finalText, decimals, format]);

  return (
    <span ref={rootRef} className={cn("inline-grid tabular-nums", className)} {...rest}>
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {finalText}
      </span>
      <span
        ref={tickRef}
        aria-hidden
        className={cn("col-start-1 row-start-1", align === "end" ? "justify-self-end" : "justify-self-start")}
      />
      <span className="sr-only">{finalText}</span>
    </span>
  );
}
