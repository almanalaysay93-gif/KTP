import { Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Redirect, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";
import ErrorBoundary from "./components/ErrorBoundary";
import { SignInPanel } from "./components/SignInPanel";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { lazyWithRetry } from "./lib/lazyWithRetry";

// Supervisor on-demand page chunks
const AreaDetail = lazyWithRetry(() => import("./pages/AreaDetail"), "AreaDetail");
const Areas = lazyWithRetry(() => import("./pages/Areas"), "Areas");
const CalendarPage = lazyWithRetry(() => import("./pages/Calendar"), "Calendar");
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"), "Dashboard");
const Licenses = lazyWithRetry(() => import("./pages/Licenses"), "Licenses");
const NurseProfile = lazyWithRetry(() => import("./pages/NurseProfile"), "NurseProfile");
const NurseEditPage = lazyWithRetry(
  () => import("./pages/NurseEditPage").then((m) => ({ default: m.NurseEditPage })),
  "NurseEditPage",
);
const Nurses = lazyWithRetry(() => import("./pages/Nurses"), "Nurses");
const Reports = lazyWithRetry(() => import("./pages/Reports"), "Reports");
const SettingsPage = lazyWithRetry(() => import("./pages/Settings"), "Settings");
const Trainings = lazyWithRetry(() => import("./pages/Trainings"), "Trainings");
const Seminars = lazyWithRetry(() => import("./pages/Seminars"), "Seminars");
const SeminarDetail = lazyWithRetry(() => import("./pages/SeminarDetail"), "SeminarDetail");
const SmartImportPage = lazyWithRetry(() => import("./pages/SmartImport"), "SmartImport");
const AiInsightsPage = lazyWithRetry(() => import("./pages/AiInsights"), "AiInsights");
const MemosPage = lazyWithRetry(() => import("./pages/Memos"), "Memos");

// Staff portal on-demand page chunks
const MyProfilePage = lazyWithRetry(() => import("./pages/MyProfilePage"), "MyProfilePage");
const StaffFeed = lazyWithRetry(() => import("./pages/StaffFeed"), "StaffFeed");
const StaffTrainingCalendar = lazyWithRetry(() => import("./pages/StaffTrainingCalendar"), "StaffTrainingCalendar");
const StaffMessages = lazyWithRetry(() => import("./pages/StaffMessages"), "StaffMessages");
const StaffSignInPage = lazyWithRetry(() => import("./pages/StaffSignIn"), "StaffSignIn");

// Public on-demand page chunks
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"), "PrivacyPolicy");
const TermsOfService = lazyWithRetry(() => import("./pages/TermsOfService"), "TermsOfService");

// Design previews (no auth, no tRPC, fictional data). Dev builds, or VITE_ENABLE_PREVIEW=true.
const PREVIEW_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_PREVIEW === "true";
const PreviewRoutes = lazyWithRetry(() => import("./pages/preview/PreviewRoutes"), "PreviewRoutes");

// Admin/supervisor routes. Signed-in non-admin (staff) accounts are bounced
// to /me — they only ever get their own profile, never the full dashboard.
function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (!loading && user && user.role !== "admin") {
    return <Redirect to="/me" />;
  }
  return <DashboardLayout>{children}</DashboardLayout>;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <Redirect to="/dashboard" />;
  return <Redirect to={user.role === "admin" ? "/dashboard" : "/me"} />;
}

// Direct sign-in entry. Signed-in users go to their home page instead.
function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <SignInPanel />;
  return <Redirect to={user.role === "admin" ? "/dashboard" : "/me"} />;
}

function Router() {
  return (
    <Suspense fallback={<DashboardLayoutSkeleton />}>
      <Switch>
      {PREVIEW_ENABLED && (
        <Route path="/preview" nest>
          <Suspense fallback={null}>
            <PreviewRoutes />
          </Suspense>
        </Route>
      )}
      <Route path="/">
        <RootRedirect />
      </Route>
      <Route path="/me">
        <StaffFeed />
      </Route>
      <Route path="/me/calendar">
        <StaffTrainingCalendar />
      </Route>
      <Route path="/me/profile">
        <MyProfilePage />
      </Route>
      <Route path="/messages">
        <Protected>
          <StaffMessages />
        </Protected>
      </Route>
      <Route path="/login">
        <LoginRoute />
      </Route>
      <Route path="/staff-signin">
        <StaffSignInPage />
      </Route>
      <Route path="/dashboard">
        <Protected>
          <Dashboard />
        </Protected>
      </Route>
      <Route path="/areas">
        <Protected>
          <Areas />
        </Protected>
      </Route>
      <Route path="/areas/:id">
        <Protected>
          <AreaDetail />
        </Protected>
      </Route>
      <Route path="/nurses">
        <Protected>
          <Nurses />
        </Protected>
      </Route>
      <Route path="/nurses/:id">
        <Protected>
          <NurseProfile />
        </Protected>
      </Route>
      <Route path="/nurses/:id/edit">
        <Protected>
          <NurseEditPage />
        </Protected>
      </Route>
      <Route path="/trainings">
        <Protected>
          <Trainings />
        </Protected>
      </Route>
      <Route path="/seminars/:id">
        <Protected>
          <SeminarDetail />
        </Protected>
      </Route>
      <Route path="/seminars">
        <Protected>
          <Seminars />
        </Protected>
      </Route>
      <Route path="/licenses">
        <Protected>
          <Licenses />
        </Protected>
      </Route>
      <Route path="/calendar">
        <Protected>
          <CalendarPage />
        </Protected>
      </Route>
      <Route path="/reports">
        <Protected>
          <Reports />
        </Protected>
      </Route>
      <Route path="/smart-import">
        <Protected>
          <SmartImportPage />
        </Protected>
      </Route>
      <Route path="/ai-insights">
        <Protected>
          <AiInsightsPage />
        </Protected>
      </Route>
      <Route path="/memos">
        <Protected>
          <MemosPage />
        </Protected>
      </Route>
      <Route path="/settings">
        <Protected>
          <SettingsPage />
        </Protected>
      </Route>
      <Route path="/privacy">
        <PrivacyPolicy />
      </Route>
      <Route path="/terms">
        <TermsOfService />
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  const { user } = useAuth();

  // Task 4.2: Idle background code preload for top supervisor destinations
  useEffect(() => {
    if (!user || user.role !== "admin") return;
    if (typeof window === "undefined") return;

    // Check data saver / slow network
    const conn = (navigator as any).connection;
    if (conn && (conn.saveData || conn.effectiveType === "2g" || conn.effectiveType === "slow-2g")) {
      return;
    }

    const preloadTopPages = () => {
      // Preload top supervisor chunks in background
      import("./pages/Dashboard").catch(() => {});
      import("./pages/Nurses").catch(() => {});
      import("./pages/Trainings").catch(() => {});
      import("./pages/Licenses").catch(() => {});
    };

    if ("requestIdleCallback" in window) {
      const handle = (window as any).requestIdleCallback(preloadTopPages, { timeout: 3000 });
      return () => (window as any).cancelIdleCallback(handle);
    } else {
      const timer = setTimeout(preloadTopPages, 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <div aria-hidden className="glass-bg" />
        <div className="relative z-[1] min-h-screen">
          <TooltipProvider>
            <Toaster position="top-right" richColors />
            <Router />
          </TooltipProvider>
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
