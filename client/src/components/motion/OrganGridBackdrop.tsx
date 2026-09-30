import { useEffect, type ReactNode } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { SPRINGS, useFinePointer, useMotionMode } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Pointer drift cap in px (DESIGN.md: up to 12). */
const DRIFT = 12;
/** Scroll parallax stops after this much scroll, so layers never leave the viewport. */
const SCROLL_CAP = 1600;

type Cell = { col: number; row: number; color: string; strength: number; depth: number };

/** Soft cells on the logo grid, each on its own depth (scroll factor 0.15 to 0.3). Strength evens out the pale and deep tokens. */
const CELLS: Cell[] = [
  { col: 0, row: 0, color: "var(--peach)", strength: 48, depth: 0.3 },
  { col: 2, row: 1, color: "var(--lilac)", strength: 32, depth: 0.24 },
  { col: 1, row: 2, color: "var(--sage)", strength: 14, depth: 0.2 },
];
const GRID_DEPTH = 0.15;

/** The drawing frame shared by every layer, so cells sit in grid cells at rest. */
const FRAME =
  "absolute left-[58%] top-[46%] aspect-square w-[min(128vmax,1320px)] -translate-x-1/2 -translate-y-1/2 max-lg:left-1/2";

export interface OrganGridBackdropProps {
  className?: string;
}

/**
 * Parallax organ-grid backdrop (admin only): the logo's 3x3 outline grid at 6% ink plus three
 * soft clay cells (peach, lilac, sage). Layers drift up to 12 px against the pointer and move at
 * 0.15 to 0.3 of the scroll. Fixed, pointer-events none, no blur filters.
 * Renders nothing on patient surfaces and under reduced motion.
 *
 * Place it inside the page root, which must be `relative isolate` (the backdrop sits at z -1 so the
 * root's own background stays behind it), and outside PageTransition.
 */
export function OrganGridBackdrop({ className }: OrganGridBackdropProps) {
  const mode = useMotionMode();
  if (mode !== "full") return null;
  return <BackdropLayers className={className} />;
}

function BackdropLayers({ className }: OrganGridBackdropProps) {
  const fine = useFinePointer();
  const { scrollY } = useScroll();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const driftX = useSpring(pointerX, SPRINGS.tilt);
  const driftY = useSpring(pointerY, SPRINGS.tilt);

  // Window-level pointer tracking into motion values only. Viewport size is cached, not re-read per move.
  useEffect(() => {
    if (!fine) return;
    let width = window.innerWidth;
    let height = window.innerHeight;
    const onResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
    };
    const onMove = (event: PointerEvent) => {
      pointerX.set((event.clientX / width - 0.5) * 2);
      pointerY.set((event.clientY / height - 0.5) * 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      pointerX.set(0);
      pointerY.set(0);
    };
  }, [fine, pointerX, pointerY]);

  return (
    <div
      aria-hidden
      data-slot="organ-grid-backdrop"
      className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden", className)}
    >
      <Layer depth={GRID_DEPTH} scrollY={scrollY} driftX={driftX} driftY={driftY}>
        <svg viewBox="0 0 300 300" className="size-full" fill="none">
          <g stroke="rgb(42 48 30 / 0.06)" strokeWidth="1.2">
            <rect x="1" y="1" width="298" height="298" rx="18" vectorEffect="non-scaling-stroke" />
            <path d="M100 1V299M200 1V299M1 100H299M1 200H299" vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
      </Layer>
      {CELLS.map((cell) => (
        <Layer key={cell.color} depth={cell.depth} scrollY={scrollY} driftX={driftX} driftY={driftY}>
          <span
            className="absolute rounded-[16%]"
            style={{
              left: `${cell.col * 33.333 + 3}%`,
              top: `${cell.row * 33.333 + 3}%`,
              width: "27.333%",
              height: "27.333%",
              // Soft clay cell without blur: lit from the top-left, fading toward the bottom-right.
              background: `linear-gradient(145deg, color-mix(in oklab, ${cell.color} ${cell.strength}%, transparent), color-mix(in oklab, ${cell.color} ${Math.round(cell.strength * 0.35)}%, transparent))`,
            }}
          />
        </Layer>
      ))}
    </div>
  );
}

function Layer({
  depth,
  scrollY,
  driftX,
  driftY,
  children,
}: {
  depth: number;
  scrollY: MotionValue<number>;
  driftX: MotionValue<number>;
  driftY: MotionValue<number>;
  children: ReactNode;
}) {
  // Deeper layers (higher scroll factor) drift further, up to the 12 px cap.
  const reach = DRIFT * (depth / 0.3);
  const x = useTransform(driftX, (v) => -v * reach);
  const y = useTransform<number, number>([scrollY, driftY], ([scroll, drift]) => -Math.min(scroll, SCROLL_CAP) * depth - drift * reach);
  return (
    <motion.div className={FRAME} style={{ x, y, willChange: "transform" }}>
      {children}
    </motion.div>
  );
}
