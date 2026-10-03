import { useCallback, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, type Variants } from "framer-motion";
import { BarChart3, CalendarDays, FileCheck2, LayoutDashboard, LogOut, Mail, Menu, MessageSquare, Settings, Users, X, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { ClayAvatar } from "@/components/clay";
import { AnimatePresence, LayoutGroup, PILL_IDS, SHARED_PILL_HOST, SharedPill, SPRINGS, useMotionMode } from "@/components/motion";
import { cn } from "@/lib/utils";
import { useAdminToast } from "./AdminToaster";
import { useAuth } from "@/_core/hooks/useAuth";

/*
 * Admin shell (DESIGN.md Components, Sidebar): 264 sidebar on the ground at 1280 and up, 80 icon rail
 * with tooltips at 1024 to 1279, top bar 56 (64 at 768) plus a drawer under 1024. The active item is
 * a raised surface-1 pill that slides between items (layoutId "nav-pill"). Items without a preview
 * route stay visible and say "Preview only" instead of navigating.
 */

export type AdminNavId = "dashboard" | "metrics" | "patients" | "zBenefit" | "calendar" | "messages" | "automations" | "settings";

const NAV: { id: AdminNavId; label: string; Icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "metrics", label: "Metrics", Icon: BarChart3 },
  { id: "patients", label: "Patients", Icon: Users },
  { id: "zBenefit", label: "Z Benefit", Icon: FileCheck2 },
  { id: "calendar", label: "Calendar", Icon: CalendarDays },
  { id: "messages", label: "Messages", Icon: MessageSquare },
  { id: "automations", label: "Automations", Icon: Mail },
  { id: "settings", label: "Settings", Icon: Settings },
];

export interface AdminShellProps {
  current: AdminNavId;
  hideUnavailable?: boolean;
  /** Nav items with a real destination. Others announce "Preview only". */
  hrefs: Partial<Record<AdminNavId, string>>;
  /** Title in the phone top bar. */
  mobileTitle: string;
  /** Right side of the phone top bar (icon buttons). */
  mobileActions?: ReactNode;
  /** id of the main landmark's first target, for the skip link. */
  skipTo: string;
  skipLabel: string;
  children: ReactNode;
  /** Optional custom sign-out handler. Defaults to auth logout. */
  onSignOut?: () => void | Promise<void>;
  /** Optional custom user override. Defaults to auth user. */
  user?: { name?: string | null; email?: string | null; role?: string | null } | null;
}

export function AdminShell({
  current,
  hrefs,
  hideUnavailable = false,
  mobileTitle,
  mobileActions,
  skipTo,
  skipLabel,
  children,
  onSignOut: customSignOut,
  user: customUser,
}: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toast = useAdminToast();
  const { user: authUser, logout } = useAuth();
  const previewOnly = (label: string) => toast({ title: "Preview only", body: `${label} is not part of this preview.`, tone: "info" });

  const isPreview = typeof window !== "undefined" && window.location.pathname.startsWith("/preview");
  const effectiveUser = customUser !== undefined ? customUser : authUser;

  const handleSignOut = useCallback(async () => {
    if (customSignOut) {
      await customSignOut();
      return;
    }
    if (isPreview) {
      previewOnly("Sign out");
      return;
    }
    try {
      await logout();
    } catch (error) {
      console.error("Sign out failed", error);
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }, [customSignOut, isPreview, logout]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[80px_minmax(0,1fr)] xl:grid-cols-[264px_minmax(0,1fr)]">
      <a
        href={`#${skipTo}`}
        className="clay-focus clay-3 fixed left-4 top-3 z-50 -translate-y-24 rounded-md bg-surface-2 px-4 py-3 type-button text-ink focus-visible:translate-y-0"
      >
        {skipLabel}
      </a>

      {/* Sidebar and rail (1024 and up) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 px-3 py-6 lg:flex xl:px-4">
        <Link href={hrefs.dashboard ?? "/"} className="clay-focus flex items-center rounded-md bg-ground px-1 xl:px-2">
          <img src="/branding/ots-logo.png" alt="Organ Transplant Services, established 2017" width={200} height={74} className="hidden h-auto w-[200px] mix-blend-multiply xl:block" />
          <img src="/branding/ots-mark.png" alt="Organ Transplant Services" width={48} height={48} className="mx-auto size-12 rounded-sm mix-blend-multiply xl:hidden" />
        </Link>
        <NavList current={current} hrefs={hrefs} hideUnavailable={hideUnavailable} onPreviewOnly={previewOnly} variant="side" />
        <AdminBlock onSignOut={handleSignOut} user={effectiveUser} isPreview={isPreview} variant="side" />
      </aside>

      {/* Phone and tablet top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-ground px-2 md:h-16 md:px-4 lg:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          className="clay-focus inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-ink hover:bg-sunken/60"
        >
          <Menu aria-hidden className="size-6" strokeWidth={1.75} />
        </button>
        <img src="/branding/ots-mark.png" alt="" width={32} height={32} className="size-8 rounded-[6px] mix-blend-multiply" />
        <p className="type-title min-w-0 flex-1 truncate text-ink">{mobileTitle}</p>
        {mobileActions}
      </header>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        {/* Own layout namespace: the hidden sidebar keeps its nav-pill mounted. */}
        <LayoutGroup id="drawer">
          <NavList current={current} hrefs={hrefs} hideUnavailable={hideUnavailable} onPreviewOnly={previewOnly} variant="drawer" onNavigate={() => setDrawerOpen(false)} />
        </LayoutGroup>
        <AdminBlock onSignOut={handleSignOut} user={effectiveUser} isPreview={isPreview} variant="drawer" />
      </Drawer>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

function NavList({
  current,
  hrefs,
  hideUnavailable,
  onPreviewOnly,
  variant,
  onNavigate,
}: {
  current: AdminNavId;
  hrefs: AdminShellProps["hrefs"];
  hideUnavailable: boolean;
  onPreviewOnly: (label: string) => void;
  variant: "side" | "drawer";
  onNavigate?: () => void;
}) {
  const rail = variant === "side";
  return (
    <nav aria-label="Admin navigation">
      <ul className="flex flex-col gap-1">
        {NAV.filter((item) => !hideUnavailable || hrefs[item.id]).map(({ id, label, Icon }) => {
          const active = id === current;
          const href = hrefs[id];
          const itemClass = cn(
            SHARED_PILL_HOST,
            "clay-focus group flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-full px-4 text-left transition-colors duration-(--dur-color)",
            "type-button",
            rail && "lg:max-xl:justify-center lg:max-xl:px-0",
            active ? "text-ink" : "text-ink-muted hover:bg-sunken/60 hover:text-ink",
          );
          const body = (
            <>
              {active ? <SharedPill id={PILL_IDS.nav} surface={1} /> : null}
              <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
              <span className={cn(rail && "lg:max-xl:sr-only")}>
                {label}
                {href ? null : <span className="sr-only">, preview only</span>}
              </span>
              {rail ? (
                <span
                  aria-hidden
                  className="type-label pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-xs bg-ink px-2.5 py-1.5 text-on-brick lg:max-xl:group-hover:block lg:max-xl:group-focus-visible:block"
                >
                  {label}
                  {href ? "" : ", preview only"}
                </span>
              ) : null}
            </>
          );
          return (
            <li key={id}>
              {href ? (
                <Link href={href} aria-current={active ? "page" : undefined} className={itemClass} onClick={onNavigate}>
                  {body}
                </Link>
              ) : (
                <button type="button" className={itemClass} onClick={() => onPreviewOnly(label)}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function AdminBlock({
  onSignOut,
  user,
  isPreview,
  variant,
}: {
  onSignOut: () => void;
  user: { name?: string | null; email?: string | null; role?: string | null } | null | undefined;
  isPreview: boolean;
  variant: "side" | "drawer";
}) {
  const rail = variant === "side";
  const name = isPreview || !user ? "KT unit admin" : (user.name || user.email || "Admin");
  const sublabel = isPreview || !user
    ? "Sample account"
    : (user.email && user.name ? user.email : (user.role === "admin" ? "Transplant coordinator" : "Staff"));

  return (
    <div className={cn("mt-auto flex items-center gap-3 border-t border-hairline pt-4", rail && "lg:max-xl:flex-col lg:max-xl:gap-2")}>
      <ClayAvatar name={name} size={40} kind="neutral" decorative />
      <p className={cn("min-w-0 flex-1", rail && "lg:max-xl:sr-only")}>
        <span className="type-body-sm block font-bold text-ink truncate">{name}</span>
        <span className="type-caption block text-ink-muted truncate">{sublabel}</span>
      </p>
      <button
        type="button"
        onClick={onSignOut}
        aria-label={isPreview ? "Sign out, preview only" : "Sign out"}
        className="clay-focus group relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-(--dur-color) hover:bg-sunken/60 hover:text-ink"
      >
        <LogOut aria-hidden className="size-5" strokeWidth={1.75} />
        {rail ? (
          <span
            aria-hidden
            className="type-label pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-xs bg-ink px-2.5 py-1.5 text-on-brick lg:max-xl:group-hover:block lg:max-xl:group-focus-visible:block"
          >
            {isPreview ? "Sign out, preview only" : "Sign out"}
          </span>
        ) : null}
      </button>
    </div>
  );
}

const DRAWER_FULL: Variants = {
  hidden: { x: "-100%" },
  show: { x: 0, transition: SPRINGS.page },
  exit: { x: "-100%", transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } },
};
const DRAWER_FADE: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

function Drawer({ open, onOpenChange, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: ReactNode }) {
  const mode = useMotionMode();
  const variants = mode === "reduced" ? DRAWER_FADE : DRAWER_FULL;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div variants={DRAWER_FADE} initial="hidden" animate="show" exit="exit" className="fixed inset-0 z-40 bg-ink/50 lg:hidden" />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                variants={variants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="clay-3 fixed inset-y-0 left-0 z-40 flex w-[min(300px,calc(100vw-48px))] flex-col gap-6 rounded-r-xl bg-ground p-4 lg:hidden"
              >
                <div className="flex items-center justify-between gap-3">
                  <img src="/branding/ots-logo.png" alt="Organ Transplant Services, established 2017" width={180} height={67} className="h-auto w-[180px] mix-blend-multiply" />
                  <DialogPrimitive.Close
                    aria-label="Close navigation"
                    className="clay-focus inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-ink hover:bg-sunken/60"
                  >
                    <X aria-hidden className="size-5" strokeWidth={1.75} />
                  </DialogPrimitive.Close>
                </div>
                <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">Admin navigation</DialogPrimitive.Description>
                {children}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
