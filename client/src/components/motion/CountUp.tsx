import { useCallback, useEffect, useLayoutEffect, useRef, type HTMLAttributes } from "react";
import { animate, cubicBezier } from "animejs";
import { useInView } from "framer-motion";
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
 * Animated numeral, admin only, driven by anime.js. Each digit is a 0-9 reel that rolls up to its value when
 * the numeral first scrolls into view (least significant digit lands last). Later changes roll from the shown
 * digit to the new one.
 * Patient surfaces and reduced motion render the final value immediately.
 * The width is reserved by an invisible copy of the final value and digits are tabular, so the
 * layout never shifts. Screen readers get the final value only: the ticking node is aria-hidden.
 * anime.js writes the reel transforms directly; React does not re-render per frame.
 */
export function CountUp({
  value,
  decimals = 0,
  format,
  duration = DURATION.countUp,
  className,
  // align is kept for API compatibility: the reels already take the width of the final value.
  align: _align,
  ...rest
}: CountUpProps) {
  const mode = useMotionMode();
  const rootRef = useRef<HTMLSpanElement>(null);
  const reelRefs = useRef<(HTMLSpanElement | null)[]>([]);
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
  const chars = Array.from(finalText);

  const place = (reel: HTMLSpanElement, digit: number) => {
    reel.style.transform = `translateY(-${digit * 10}%)`;
    reel.dataset.d = String(digit);
  };

  // Park new reels on 0 (or on the final digit when motion is off) before the first frame.
  useLayoutEffect(() => {
    chars.forEach((c, i) => {
      const reel = reelRefs.current[i];
      if (!reel || !/\d/.test(c)) return;
      if (!shouldCount) place(reel, Number(c));
      else if (reel.dataset.d === undefined) place(reel, 0);
    });
  }, [shouldCount, finalText]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shouldCount || !inView) return;
    const controls: { cancel: () => void }[] = [];
    chars.forEach((c, i) => {
      const reel = reelRefs.current[i];
      if (!reel || !/\d/.test(c)) return;
      const to = Number(c);
      const from = Number(reel.dataset.d ?? 0);
      if (from === to) return;
      const fromsRight = chars.length - 1 - i;
      controls.push(
        animate(reel, {
          translateY: [`-${from * 10}%`, `-${to * 10}%`],
          duration: duration * 1000 + 250,
          delay: fromsRight * 70,
          ease: cubicBezier(...EASE.out),
          onComplete: () => place(reel, to),
        }),
      );
      reel.dataset.d = String(to);
    });
    return () => controls.forEach(c => c.cancel());
  }, [inView, shouldCount, finalText, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span ref={rootRef} className={cn("inline-flex tabular-nums", className)} {...rest}>
      <span aria-hidden className="inline-flex">
        {chars.map((c, i) =>
          /\d/.test(c) ? (
            <span key={chars.length - i} className="relative inline-block overflow-hidden">
              <span className="invisible">{c}</span>
              <span
                ref={el => {
                  reelRefs.current[i] = el;
                }}
                className="absolute left-0 top-0 flex w-full flex-col text-center will-change-transform"
              >
                {"0123456789".split("").map(d => (
                  <span key={d} className="block">
                    {d}
                  </span>
                ))}
              </span>
            </span>
          ) : (
            <span key={chars.length - i}>{c}</span>
          ),
        )}
      </span>
      <span className="sr-only">{finalText}</span>
    </span>
  );
}
