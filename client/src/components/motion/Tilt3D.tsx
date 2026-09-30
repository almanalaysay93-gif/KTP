import { forwardRef, useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, type HTMLMotionProps, type MotionStyle, type MotionValue } from "framer-motion";
import { SPRINGS, useFinePointer, useMotionMode } from "@/lib/motion";
import { cn } from "@/lib/utils";

const MAX_DEG = 5;
const PERSPECTIVE = 900;
const GLOW_SIZE = 260;
const GLOW_SPRING = { stiffness: 300, damping: 30, mass: 1 };

type PointerHandler<E extends Element> = (event: ReactPointerEvent<E>) => void;

export interface TiltHandlers<E extends Element> {
  onPointerEnter?: PointerHandler<E>;
  onPointerMove?: PointerHandler<E>;
  onPointerLeave?: PointerHandler<E>;
}

export interface UseTiltResult<E extends Element> {
  /** false on patient surfaces, touch or coarse pointers, and reduced motion. */
  active: boolean;
  /** Spread into the motion element's style. */
  style: MotionStyle;
  /** Spread onto the element. Chains the handlers you pass in. */
  handlers: TiltHandlers<E>;
  /** Render inside the element (it needs position: relative). */
  highlight: ReactNode;
}

/**
 * Pointer-follow 3D tilt (admin only). Rotates up to 5 deg toward the pointer on the `tilt` spring,
 * with a radial highlight that translates with the pointer, and resets on leave.
 * Pointer tracking writes motion values only (no React state). The element rect is read once per
 * hover (and again only after a scroll), never on every move.
 */
export function useTilt<E extends Element = HTMLElement>(
  options: { enabled?: boolean; max?: number } & TiltHandlers<E> = {},
): UseTiltResult<E> {
  const { enabled = true, max = MAX_DEG, onPointerEnter, onPointerMove, onPointerLeave } = options;
  const mode = useMotionMode();
  const fine = useFinePointer();
  const active = enabled && mode === "full" && fine;

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const glowX = useMotionValue(0);
  const glowY = useMotionValue(0);
  const glow = useMotionValue(0);
  const springX = useSpring(rotateX, SPRINGS.tilt);
  const springY = useSpring(rotateY, SPRINGS.tilt);
  const springGlowX = useSpring(glowX, SPRINGS.tilt);
  const springGlowY = useSpring(glowY, SPRINGS.tilt);
  const springGlow = useSpring(glow, GLOW_SPRING);
  const rectRef = useRef<DOMRect | null>(null);

  // A scroll while hovering moves the element: drop the cached rect, re-read lazily on the next move.
  useEffect(() => {
    if (!active) return;
    const invalidate = () => {
      rectRef.current = null;
    };
    window.addEventListener("scroll", invalidate, { passive: true, capture: true });
    window.addEventListener("resize", invalidate, { passive: true });
    return () => {
      window.removeEventListener("scroll", invalidate, { capture: true });
      window.removeEventListener("resize", invalidate);
    };
  }, [active]);

  const reset = useCallback(() => {
    rectRef.current = null;
    rotateX.set(0);
    rotateY.set(0);
    glow.set(0);
  }, [rotateX, rotateY, glow]);

  // Leaving full mode (for example the OS switches on reduced motion) snaps back to flat.
  useEffect(() => {
    if (!active) {
      reset();
      springX.jump(0);
      springY.jump(0);
      springGlow.jump(0);
    }
  }, [active, reset, springX, springY, springGlow]);

  const handlers: TiltHandlers<E> = {
    onPointerEnter: (event) => {
      onPointerEnter?.(event);
      if (!active || event.pointerType === "touch") return;
      rectRef.current = null;
      glow.set(1);
    },
    onPointerMove: (event) => {
      onPointerMove?.(event);
      if (!active || event.pointerType === "touch") return;
      const rect = (rectRef.current ??= event.currentTarget.getBoundingClientRect());
      if (rect.width === 0 || rect.height === 0) return;
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const px = Math.min(Math.max(localX / rect.width, 0), 1);
      const py = Math.min(Math.max(localY / rect.height, 0), 1);
      rotateX.set((0.5 - py) * 2 * max);
      rotateY.set((px - 0.5) * 2 * max);
      glowX.set(localX);
      glowY.set(localY);
    },
    onPointerLeave: (event) => {
      onPointerLeave?.(event);
      reset();
    },
  };

  return {
    active,
    style: active ? { rotateX: springX, rotateY: springY, transformPerspective: PERSPECTIVE } : {},
    handlers: active ? handlers : { onPointerEnter, onPointerMove, onPointerLeave },
    highlight: active ? <TiltHighlight x={springGlowX} y={springGlowY} opacity={springGlow} /> : null,
  };
}

function TiltHighlight({ x, y, opacity }: { x: MotionValue<number>; y: MotionValue<number>; opacity: MotionValue<number> }) {
  return (
    <span
      aria-hidden
      data-slot="tilt-highlight"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ borderRadius: "inherit" }}
    >
      <motion.span
        className="absolute left-0 top-0 block"
        style={{
          x,
          y,
          opacity,
          width: GLOW_SIZE,
          height: GLOW_SIZE,
          marginLeft: -GLOW_SIZE / 2,
          marginTop: -GLOW_SIZE / 2,
          background: "radial-gradient(closest-side, rgb(255 255 255 / 0.75), rgb(255 255 255 / 0))",
        }}
      />
    </span>
  );
}

export interface Tilt3DProps extends HTMLMotionProps<"div"> {
  /** Max rotation in degrees (5 by default, the DESIGN.md cap). */
  max?: number;
  enabled?: boolean;
  children?: ReactNode;
}

/**
 * Tilt surface for any raised block (a card, the sign-in tray). It must be the surface itself (give it
 * the clay classes and background), because the highlight paints between its background and its
 * content; an opaque child would hide it. For tray cells use MotionClayCell.
 */
export const Tilt3D = forwardRef<HTMLDivElement, Tilt3DProps>(function Tilt3D(
  { max, enabled = true, className, style, children, onPointerEnter, onPointerMove, onPointerLeave, ...rest },
  ref,
) {
  const tilt = useTilt<HTMLDivElement>({ enabled, max, onPointerEnter, onPointerMove, onPointerLeave });
  return (
    <motion.div
      ref={ref}
      data-tilt={tilt.active || undefined}
      className={cn("relative isolate", className)}
      style={{ ...style, ...tilt.style }}
      {...tilt.handlers}
      {...rest}
    >
      {children}
      {tilt.highlight}
    </motion.div>
  );
});
