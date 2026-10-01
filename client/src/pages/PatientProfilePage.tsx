import { useEffect, useState } from "react";
import { ArrowLeft, Save, LogOut, Phone, Mail, User, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { ClayAvatar, ClayButton, ClayCard } from "@/components/clay";
import { PATIENT_TABS, PatientShell, type PatientTabId } from "@/components/ktp/patient";
import { PageTransition } from "@/components/motion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export default function PatientProfilePage() {
  const [, navigate] = useLocation();
  const { logout } = useAuth();
  const profileQuery = trpc.patientPortal.getMyProfile.useQuery();
  const updateContactMutation = trpc.patientPortal.updateContact.useMutation();

  const [contactNumber, setContactNumber] = useState("");
  const [editing, setEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    document.title = "Profile | KTP";
  }, []);

  useEffect(() => {
    if (profileQuery.data?.patient) {
      setContactNumber(profileQuery.data.patient.contactNumber ?? "");
    }
  }, [profileQuery.data]);

  const patient = profileQuery.data?.patient;
  const nephrologist = profileQuery.data?.nephrologist;
  const fellow = profileQuery.data?.fellow;
  const linkedRecipientName = profileQuery.data?.linkedRecipientName;

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateContactMutation.mutateAsync({ contactNumber: contactNumber.trim() || null });
    setEditing(false);
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 3000);
    profileQuery.refetch();
  };

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
        <ClayButton variant="ghost" size="sm" icon={<LogOut className="size-4" />} onClick={() => logout()}>
          Sign Out
        </ClayButton>
      }
    >
      <PageTransition routeKey="patient-profile" focusHeading={false}>
        <div className="flex flex-col gap-6">
          <header className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate("/me")}
              className="clay-focus rounded-full p-2 text-ink-muted hover:bg-surface-2"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div>
              <h1 className="type-display text-ink">My Profile</h1>
              <p className="type-body-sm text-ink-muted">Personal records and care team</p>
            </div>
          </header>

          {successMsg && (
            <div className="rounded-lg bg-olive-tint p-4 type-body-sm text-olive">
              Contact number updated successfully.
            </div>
          )}

          {/* Profile Overview Card */}
          <ClayCard className="p-6">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <ClayAvatar
                name={patient ? `${patient.firstName} ${patient.lastName}` : "Patient"}
                size={72}
              />
              <div className="flex flex-1 flex-col text-center sm:text-left">
                <h2 className="type-display text-ink">
                  {patient ? `${patient.firstName} ${patient.lastName} ${patient.suffix ?? ""}` : "Loading..."}
                </h2>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="font-mono type-body-sm text-ink-muted">HRN: {patient?.hrn}</span>
                  <span className="inline-flex rounded-full bg-olive-tint px-2 py-0.5 type-label text-olive">
                    {patient?.patientType}
                  </span>
                  <span className="inline-flex rounded-full bg-sunken px-2 py-0.5 type-label text-ink">
                    Stage: {patient?.stage}
                  </span>
                </div>
              </div>
            </div>
          </ClayCard>

          {/* Editable Contact Info */}
          <ClayCard className="p-6">
            <h3 className="type-headline text-ink">Contact Details</h3>
            <p className="type-body-sm text-ink-muted">
              You can update your mobile number directly. To change your registered Gmail, contact the KT unit.
            </p>

            <form onSubmit={handleSaveContact} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="type-label text-ink-muted">Registered Gmail</label>
                <div className="mt-1 flex items-center gap-2 text-ink type-body">
                  <Mail className="size-4 text-ink-muted" />
                  <span>{patient?.accountEmail}</span>
                </div>
              </div>

              <div>
                <label className="type-label text-ink">Mobile phone number</label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="tel"
                    disabled={!editing}
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. 0917-123-4567"
                    className="max-w-xs rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none disabled:opacity-75"
                  />
                  {editing ? (
                    <div className="flex gap-2">
                      <ClayButton
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={updateContactMutation.isPending}
                      >
                        Save
                      </ClayButton>
                      <ClayButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setContactNumber(patient?.contactNumber ?? "");
                          setEditing(false);
                        }}
                      >
                        Cancel
                      </ClayButton>
                    </div>
                  ) : (
                    <ClayButton type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
                      Edit number
                    </ClayButton>
                  )}
                </div>
              </div>
            </form>
          </ClayCard>

          {/* Care Team */}
          <ClayCard className="p-6">
            <h3 className="type-headline text-ink">My Care Team</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-surface-2 p-4">
                <p className="type-label text-ink-muted">Nephrologist</p>
                <p className="mt-1 font-semibold text-ink type-body">{nephrologist?.name ?? "Assigned by clinic"}</p>
              </div>
              <div className="rounded-lg bg-surface-2 p-4">
                <p className="type-label text-ink-muted">Fellow in charge</p>
                <p className="mt-1 font-semibold text-ink type-body">{fellow?.name ?? "Assigned by clinic"}</p>
              </div>
              {patient?.patientType === "Donor" && linkedRecipientName && (
                <div className="rounded-lg bg-surface-2 p-4 sm:col-span-2">
                  <p className="type-label text-ink-muted">Linked Recipient</p>
                  <p className="mt-1 font-semibold text-ink type-body">{linkedRecipientName}</p>
                </div>
              )}
            </div>
          </ClayCard>

          {/* Data Privacy Status */}
          <ClayCard className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-olive-tint text-olive">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h4 className="type-headline text-ink">Consent on File</h4>
                <p className="type-body-sm text-ink-muted">
                  Version {patient?.consentVersion ?? 1} accepted on{" "}
                  {patient?.consentAcceptedAt
                    ? new Date(patient.consentAcceptedAt).toLocaleDateString()
                    : "enrollment"}
                  .
                </p>
              </div>
            </div>
          </ClayCard>

          {/* Logout button */}
          <div className="flex justify-center pb-8">
            <ClayButton variant="ghost" icon={<LogOut className="size-4" />} onClick={() => logout()}>
              Sign Out
            </ClayButton>
          </div>
        </div>
      </PageTransition>
    </PatientShell>
  );
}
