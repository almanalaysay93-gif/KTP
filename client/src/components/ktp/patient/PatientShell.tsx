import type { ReactNode } from "react";
import { MotionRoot } from "@/components/motion";
import { cn } from "@/lib/utils";
import { BottomTabBar, TopPillNav, useMediaQuery, type PatientNavProps } from "./PatientNav";

export interface PatientShellProps extends PatientNavProps {
  /** Right side of the desktop top bar (avatar, preview badge). */
  topBarEnd?: ReactNode;
  /** Forces reduced motion (an in-app preference or a preview toggle). OS reduced motion always wins. */
  reducedMotion?: "user" | "always";
  /** Rendered after main, outside any transform (toasts). */
  overlay?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Patient layout, phone first (DESIGN.md Layout). Under 1024: content column (max 640 at 768)
 * with the floating bottom tab bar and room reserved for it plus the safe area. From 1024: a top
 * bar with the wordmark and the pill nav, content centered at max 1040.
 * Motion runs at the calmer "lively" intensity. The tab bar stays outside page transitions.
 */
export function PatientShell({
  topBarEnd,
  reducedMotion = "user",
  overlay,
  children,
  className,
  ...nav
}: PatientShellProps) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  return (
    <MotionRoot intensity="lively" reducedMotion={reducedMotion}>
      <div data-surface="patient" className={cn("min-h-dvh bg-ground text-ink", className)}>
        <a
          href="#main"
          className="clay-focus type-button sr-only z-50 rounded-md bg-surface-2 px-4 py-3 text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:px-4 focus:py-3"
        >
          Skip to main content
        </a>
        {desktop ? (
          <header className="mx-auto flex w-full max-w-[1104px] items-center gap-6 px-8 pb-2 pt-6">
            <img
              src="/branding/ots-logo.png"
              alt="Organ Transplant Services, established 2017"
              width={180}
              height={67}
              decoding="async"
              className="h-auto w-[180px] shrink-0 mix-blend-multiply"
            />
            <div className="flex flex-1 justify-center">
              <TopPillNav {...nav} />
            </div>
            <div className="flex shrink-0 items-center gap-3">{topBarEnd}</div>
          </header>
        ) : null}
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[640px] px-4 pb-[calc(64px+12px+56px+env(safe-area-inset-bottom,0px))] pt-[calc(12px+env(safe-area-inset-top,0px))] outline-none md:px-6 lg:max-w-[1104px] lg:px-8 lg:pb-16 lg:pt-6"
        >
          {children}
        </main>
        {desktop ? null : <BottomTabBar {...nav} />}
        {overlay}
      </div>
    </MotionRoot>
  );
}
