import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ClayAvatar, ClayButton, ClayCard } from "@/components/clay";
import {
  EmergencyBand,
  PATIENT_TABS,
  PatientShell,
  PatientToastRegion,
  usePatientToast,
  type PatientTabId,
} from "@/components/ktp/patient";
import { MotionRoot, PageTransition } from "@/components/motion";
import { trpc } from "@/lib/trpc";
import { todayDate } from "@shared/ktp";
import { CalendarDays, Clock, FileText, FlaskConical, LogOut, Phone, User } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function PatientHome() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { toast, show, dismiss } = usePatientToast();
  const profileQuery = trpc.patientPortal.getMyProfile.useQuery();
  const settingsQuery = trpc.settings.getAll.useQuery();

  useEffect(() => {
    document.title = "Home | KTP";
  }, []);

  const patient = profileQuery.data?.patient;
  const hotline = settingsQuery.data?.emergencyHotlineText ?? "KT Unit Hotline: 0917-000-0000";

  const handleNav = (tabId: PatientTabId) => {
    if (tabId === "home") navigate("/me");
    else if (tabId === "labs") navigate("/me/labs");
    else if (tabId === "checklist") navigate("/me/checklist");
    else if (tabId === "calendar") navigate("/me/calendar");
    else if (tabId === "messages") navigate("/me/messages");
  };

  return (
    <PatientShell
      active="home"
      onNavigate={handleNav}
      unread={0}
      tabs={PATIENT_TABS}
      topBarEnd={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/me/profile")}
            className="clay-focus flex items-center gap-2 rounded-full p-1"
          >
            <ClayAvatar
              name={patient ? `${patient.firstName} ${patient.lastName}` : "Patient"}
              size={40}
            />
          </button>
        </div>
      }
      overlay={<PatientToastRegion toast={toast} onDismiss={dismiss} />}
    >
      <PageTransition routeKey="patient-home" focusHeading={false}>
        <div className="flex flex-col gap-6">
          {/* Welcome Header */}
          <header className="flex flex-col gap-1 pt-2">
            <p className="type-body-sm text-ink-muted">Welcome back</p>
            <h1 className="type-display text-ink">
              {patient ? `${patient.firstName} ${patient.lastName}` : "Patient Portal"}
            </h1>
            {patient && (
              <p className="type-body-sm text-ink-muted">
                HRN: <span className="font-mono text-ink">{patient.hrn}</span> &bull; Stage:{" "}
                <span className="font-medium text-ink">{patient.stage}</span>
              </p>
            )}
          </header>

          {/* Emergency Band */}
          <EmergencyBand hotlineText={hotline} hotlineTel="0917000000" />

          {/* Quick Access Tiles */}
          <div className="grid gap-4 sm:grid-cols-2">
            <ClayCard
              onClick={() => navigate("/me/labs")}
              className="flex cursor-pointer items-center gap-4 p-5 transition hover:shadow-md"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-olive-tint text-olive">
                <FlaskConical className="size-6" />
              </div>
              <div>
                <h3 className="type-headline text-ink">Lab Results</h3>
                <p className="type-body-sm text-ink-muted">Check blood and urine lab trends</p>
              </div>
            </ClayCard>

            <ClayCard
              onClick={() => navigate("/me/checklist")}
              className="flex cursor-pointer items-center gap-4 p-5 transition hover:shadow-md"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-brick-tint text-brick">
                <FileText className="size-6" />
              </div>
              <div>
                <h3 className="type-headline text-ink">Workup Checklist</h3>
                <p className="type-body-sm text-ink-muted">Pre-transplant evaluation status</p>
              </div>
            </ClayCard>

            <ClayCard
              onClick={() => navigate("/me/calendar")}
              className="flex cursor-pointer items-center gap-4 p-5 transition hover:shadow-md"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-sunken text-ink">
                <CalendarDays className="size-6" />
              </div>
              <div>
                <h3 className="type-headline text-ink">Appointments</h3>
                <p className="type-body-sm text-ink-muted">Upcoming clinic visits and confirmations</p>
              </div>
            </ClayCard>

            <ClayCard
              onClick={() => navigate("/me/profile")}
              className="flex cursor-pointer items-center gap-4 p-5 transition hover:shadow-md"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-sunken text-ink">
                <User className="size-6" />
              </div>
              <div>
                <h3 className="type-headline text-ink">My Profile</h3>
                <p className="type-body-sm text-ink-muted">Contact details and care team</p>
              </div>
            </ClayCard>
          </div>

          {/* Sign Out Button on Mobile */}
          <div className="mt-4 flex justify-center pb-8 lg:hidden">
            <ClayButton variant="ghost" icon={<LogOut className="size-4" />} onClick={() => logout()}>
              Sign Out
            </ClayButton>
          </div>
        </div>
      </PageTransition>
    </PatientShell>
  );
}
