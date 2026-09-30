import { Suspense, useEffect, type ComponentType, type LazyExoticComponent } from "react";
import { ArrowRight } from "lucide-react";
import { Link, Route, Switch } from "wouter";
import { ClayCard, ClaySkeleton, ClaySkeletonGroup, StatusChip } from "@/components/clay";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

/**
 * Preview pages: no auth, no tRPC, fictional data only.
 * Mounted by App.tsx as a nested route at /preview, so paths here are relative ("/system" is /preview/system).
 * To add a page, append one entry.
 */
export interface PreviewPage {
  path: string;
  title: string;
  description: string;
  component: LazyExoticComponent<ComponentType>;
}

export const PREVIEW_PAGES: PreviewPage[] = [
  {
    path: "/system",
    title: "Design system",
    description: "Tokens, type roles, clay levels, and every clay component in every state.",
    component: lazyWithRetry(() => import("./DesignSystemPreview"), "DesignSystemPreview"),
  },
  {
    path: "/motion",
    title: "Motion",
    description: "Every motion primitive twice: admin at full intensity beside the calmer patient version.",
    component: lazyWithRetry(() => import("./MotionPreview"), "MotionPreview"),
  },
  {
    path: "/admin",
    title: "Admin dashboard",
    description: "Nine-Cell triage tray, triage lists, and patients by stage, at full admin motion.",
    component: lazyWithRetry(() => import("./AdminDashboardPreview"), "AdminDashboardPreview"),
  },
  {
    path: "/patient",
    title: "Patient profile",
    description: "Admin view of one patient: stage stepper, 4-item tracker, lab trend, and profile tabs.",
    component: lazyWithRetry(() => import("./PatientProfilePreview"), "PatientProfilePreview"),
  },
];

export function SampleDataBadge() {
  return (
    <StatusChip
      status="info"
      label="Sample data"
      srDetail="fictional patients for preview only"
      title="Fictional patients for preview only. No real patient data."
    />
  );
}

function PreviewIndex() {
  useEffect(() => {
    document.title = "Preview | KTP";
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1040px] flex-col gap-8 px-4 py-10 md:px-6 lg:px-8 lg:py-16">
      <header className="flex flex-col items-start gap-3">
        <SampleDataBadge />
        <h1 className="type-display text-ink">Preview screens</h1>
        <p className="type-body-lg max-w-[60ch] text-ink-muted">
          Screens rendered with fictional data, outside sign-in. Available in development builds only.
        </p>
      </header>
      <ul className="grid gap-4 md:grid-cols-2">
        {PREVIEW_PAGES.map((page) => (
          <li key={page.path}>
            <ClayCard asChild interactive>
              <Link href={page.path} className="flex h-full flex-col gap-2">
                <span className="flex items-center justify-between gap-3">
                  <span className="type-title text-ink">{page.title}</span>
                  <ArrowRight aria-hidden className="size-5 text-brick" strokeWidth={1.75} />
                </span>
                <span className="type-body-sm text-ink-muted">{page.description}</span>
                <span className="type-data text-ink-muted">/preview{page.path}</span>
              </Link>
            </ClayCard>
          </li>
        ))}
      </ul>
    </main>
  );
}

function PreviewFallback() {
  return (
    <ClaySkeletonGroup label="Loading preview" className="mx-auto flex max-w-[1040px] flex-col gap-4 px-4 py-10">
      <ClaySkeleton shape="pill" className="h-8 w-40" />
      <ClaySkeleton className="h-10 w-72 max-w-full" />
      <ClaySkeleton className="h-64 w-full rounded-xl" />
    </ClaySkeletonGroup>
  );
}

export default function PreviewRoutes() {
  return (
    <Suspense fallback={<PreviewFallback />}>
      <Switch>
        <Route path="/">
          <PreviewIndex />
        </Route>
        {PREVIEW_PAGES.map(({ path, component: Page }) => (
          <Route key={path} path={path}>
            <Page />
          </Route>
        ))}
        <Route>
          <PreviewIndex />
        </Route>
      </Switch>
    </Suspense>
  );
}
