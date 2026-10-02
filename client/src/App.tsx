import { Suspense, useEffect } from "react"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import NotFound from "@/pages/NotFound"
import { Route, Redirect, Switch } from "wouter"
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton"
import ErrorBoundary from "./components/ErrorBoundary"
import { ThemeProvider } from "./contexts/ThemeContext"
import { useAuth } from "./_core/hooks/useAuth"
import { lazyWithRetry } from "./lib/lazyWithRetry"
import { ConsentGate } from "./components/ktp/ConsentGate"

// Admin on-demand pages
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"), "Dashboard")
const PatientsPage = lazyWithRetry(() => import("./pages/PatientsPage"), "PatientsPage")
const PatientEnrollPage = lazyWithRetry(() => import("./pages/PatientEnrollPage"), "PatientEnrollPage")
const PatientDetailPage = lazyWithRetry(() => import("./pages/PatientDetailPage"), "PatientDetailPage")
const SettingsPage = lazyWithRetry(() => import("./pages/Settings"), "Settings")

// Patient portal on-demand pages
const PatientHome = lazyWithRetry(() => import("./pages/PatientHome"), "PatientHome")
const PatientProfilePage = lazyWithRetry(() => import("./pages/PatientProfilePage"), "PatientProfilePage")
const PatientLabsPage = lazyWithRetry(() => import("./pages/PatientLabsPage"), "PatientLabsPage")
const PatientChecklistPage = lazyWithRetry(() => import("./pages/PatientChecklistPage"), "PatientChecklistPage")
const PatientCalendarPage = lazyWithRetry(() => import("./pages/PatientCalendarPage"), "PatientCalendarPage")
const PatientMessagesPage = lazyWithRetry(() => import("./pages/PatientMessagesPage"), "PatientMessagesPage")

// Auth & public pages
const SignInPage = lazyWithRetry(() => import("./pages/SignInPage"), "SignInPage")
const NotEnrolledPage = lazyWithRetry(() => import("./pages/NotEnrolledPage"), "NotEnrolledPage")
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"), "PrivacyPolicy")
const TermsOfService = lazyWithRetry(() => import("./pages/TermsOfService"), "TermsOfService")

// Design previews (no auth, no tRPC, fictional data). Dev builds, or VITE_ENABLE_PREVIEW=true.
const PREVIEW_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_PREVIEW === "true"
const PreviewRoutes = lazyWithRetry(() => import("./pages/preview/PreviewRoutes"), "PreviewRoutes")

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <DashboardLayoutSkeleton />
  if (!user) return <Redirect to="/login" />
  if (!user.isAdmin) {
    return <Redirect to="/me" />
  }
  return <>{children}</>
}

function PatientProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <DashboardLayoutSkeleton />
  if (!user) return <Redirect to="/login" />
  if (user.isAdmin) {
    return <Redirect to="/dashboard" />
  }
  return <ConsentGate>{children}</ConsentGate>
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <DashboardLayoutSkeleton />
  if (!user) return <Redirect to="/login" />
  return <Redirect to={user.isAdmin ? "/dashboard" : "/me"} />
}

function LoginRoute() {
  const { user, loading } = useAuth()
  if (loading) return <DashboardLayoutSkeleton />
  if (!user) return <SignInPage />
  return <Redirect to={user.isAdmin ? "/dashboard" : "/me"} />
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
        <Route path="/login">
          <LoginRoute />
        </Route>
        <Route path="/not-enrolled">
          <NotEnrolledPage />
        </Route>

        {/* Admin routes */}
        <Route path="/dashboard">
          <Protected>
            <Dashboard />
          </Protected>
        </Route>
        <Route path="/patients">
          <Protected>
            <PatientsPage />
          </Protected>
        </Route>
        <Route path="/patients/new">
          <Protected>
            <PatientEnrollPage />
          </Protected>
        </Route>
        <Route path="/patients/:id">
          <Protected>
            <PatientDetailPage />
          </Protected>
        </Route>
        <Route path="/patients/:id/edit">
          <Protected>
            <PatientEnrollPage />
          </Protected>
        </Route>
        <Route path="/settings">
          <Protected>
            <SettingsPage />
          </Protected>
        </Route>
        <Route path="/calendar">
          <Protected>
            <Redirect to="/dashboard" />
          </Protected>
        </Route>
        <Route path="/messages">
          <Protected>
            <Redirect to="/dashboard" />
          </Protected>
        </Route>
        <Route path="/notifications">
          <Protected>
            <Redirect to="/dashboard" />
          </Protected>
        </Route>

        {/* Patient portal routes */}
        <Route path="/me">
          <PatientProtected>
            <PatientHome />
          </PatientProtected>
        </Route>
        <Route path="/me/profile">
          <PatientProtected>
            <PatientProfilePage />
          </PatientProtected>
        </Route>
        <Route path="/me/labs">
          <PatientProtected>
            <PatientLabsPage />
          </PatientProtected>
        </Route>
        <Route path="/me/checklist">
          <PatientProtected>
            <PatientChecklistPage />
          </PatientProtected>
        </Route>
        <Route path="/me/calendar">
          <PatientProtected>
            <PatientCalendarPage />
          </PatientProtected>
        </Route>
        <Route path="/me/messages">
          <PatientProtected>
            <PatientMessagesPage />
          </PatientProtected>
        </Route>

        {/* Public routes */}
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
  )
}

function App() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user || !user.isAdmin) return
    if (typeof window === "undefined") return

    const conn = (navigator as any).connection
    if (conn && (conn.saveData || conn.effectiveType === "2g" || conn.effectiveType === "slow-2g")) {
      return
    }

    const preloadTopPages = () => {
      import("./pages/Dashboard").catch(() => {})
      import("./pages/PatientsPage").catch(() => {})
      import("./pages/Settings").catch(() => {})
    }

    if ("requestIdleCallback" in window) {
      const handle = (window as any).requestIdleCallback(preloadTopPages, { timeout: 3000 })
      return () => (window as any).cancelIdleCallback(handle)
    } else {
      const timer = setTimeout(preloadTopPages, 1500)
      return () => clearTimeout(timer)
    }
  }, [user])

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={false}>
        <div aria-hidden className="glass-bg" />
        <div className="relative z-[1] min-h-screen">
          <TooltipProvider>
            <Toaster position="top-right" richColors />
            <Router />
          </TooltipProvider>
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
