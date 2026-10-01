import { useEffect, useState } from "react";
import { Plus, Save, ShieldAlert, UserCheck } from "lucide-react";
import { AdminShell, AdminToaster, useAdminToast } from "@/components/ktp/admin";
import { ClayButton, ClayCard, ClayTabs, ClayTabsList, ClayTabsTrigger, ClayTabsContent } from "@/components/clay";
import { MotionRoot, OrganGridBackdrop, PageTransition } from "@/components/motion";
import { trpc } from "@/lib/trpc";
import { DOCTOR_ROLES, type DoctorRole } from "@shared/ktp";

const ADMIN_HREFS = {
  dashboard: "/dashboard",
  patients: "/patients",
  calendar: "/calendar",
  messages: "/messages",
  settings: "/settings",
} as const;

export default function SettingsPage() {
  const toast = useAdminToast();
  const utils = trpc.useUtils();
  const settingsQuery = trpc.settings.getAll.useQuery();
  const doctorsQuery = trpc.doctors.list.useQuery({ activeOnly: false });

  const [emergencyHotlineText, setEmergencyHotlineText] = useState("");
  const [consentNoticeText, setConsentNoticeText] = useState("");
  const [consentVersion, setConsentVersion] = useState<number>(1);
  const [appTitle, setAppTitle] = useState("");
  const [orgName, setOrgName] = useState("");

  // Doctor modal state
  const [showDoctorDialog, setShowDoctorDialog] = useState(false);
  const [doctorName, setDoctorName] = useState("");
  const [doctorRole, setDoctorRole] = useState<DoctorRole>("Nephrologist");

  useEffect(() => {
    document.title = "Settings | KTP";
  }, []);

  useEffect(() => {
    if (settingsQuery.data) {
      setEmergencyHotlineText(settingsQuery.data.emergencyHotlineText);
      setConsentNoticeText(settingsQuery.data.consentNoticeText);
      setConsentVersion(parseInt(settingsQuery.data.consentVersion, 10) || 1);
      setAppTitle(settingsQuery.data.appTitle);
      setOrgName(settingsQuery.data.orgName);
    }
  }, [settingsQuery.data]);

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast({ title: "Settings saved", body: "Application settings have been updated.", tone: "done" });
      utils.settings.getAll.invalidate();
    },
    onError: (err) => {
      toast({ title: "Save failed", body: err.message, tone: "info" });
    },
  });

  const createDoctorMutation = trpc.doctors.create.useMutation({
    onSuccess: () => {
      toast({ title: "Doctor added", body: "Care team member was added successfully.", tone: "done" });
      setShowDoctorDialog(false);
      setDoctorName("");
      utils.doctors.list.invalidate();
    },
  });

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync({
      emergencyHotlineText,
      consentNoticeText,
      consentVersion,
      appTitle,
      orgName,
    });
  };

  const handleBumpConsentVersion = () => {
    setConsentVersion((prev) => prev + 1);
    toast({
      title: "Consent version incremented",
      body: "Save settings to require all patients to accept the updated privacy notice upon their next sign-in.",
      tone: "info",
    });
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorName.trim()) return;
    await createDoctorMutation.mutateAsync({
      name: doctorName.trim(),
      role: doctorRole,
      active: true,
    });
  };

  return (
    <MotionRoot intensity="full">
      <AdminToaster>
        <div data-surface="admin" className="relative isolate min-h-dvh bg-ground text-ink">
          <OrganGridBackdrop />
          <AdminShell
            current="settings"
            hrefs={ADMIN_HREFS}
            mobileTitle="Settings"
            skipTo="settings-content"
            skipLabel="Skip to settings content"
          >
            <PageTransition routeKey="settings" focusHeading={false}>
              <main id="settings-content" className="mx-auto w-full max-w-[960px] px-4 pb-16 md:px-6 lg:px-8 lg:pb-20">
                <header className="pt-4 lg:pt-8">
                  <h1 className="type-display text-ink">Settings</h1>
                  <p className="type-body-sm text-ink-muted">
                    Clinical team, emergency hotline, and data privacy consent configuration
                  </p>
                </header>

                <div className="mt-8">
                  <ClayTabs defaultValue="general">
                    <ClayTabsList>
                      <ClayTabsTrigger value="general">General & Hotline</ClayTabsTrigger>
                      <ClayTabsTrigger value="privacy">Privacy & Consent</ClayTabsTrigger>
                      <ClayTabsTrigger value="doctors">Care Team Doctors</ClayTabsTrigger>
                    </ClayTabsList>

                    {/* Tab 1: General & Hotline */}
                    <ClayTabsContent value="general" className="mt-6">
                      <form onSubmit={handleSaveSettings} className="flex flex-col gap-6">
                        <ClayCard className="p-6">
                          <h2 className="type-headline text-ink">Emergency Contact Information</h2>
                          <p className="type-body-sm text-ink-muted">
                            Shown on every patient page and banner in the patient portal.
                          </p>

                          <div className="mt-4">
                            <label className="type-label text-ink">Emergency Hotline Text</label>
                            <input
                              type="text"
                              required
                              value={emergencyHotlineText}
                              onChange={(e) => setEmergencyHotlineText(e.target.value)}
                              placeholder="KT Unit Hotline: 0917-000-0000"
                              className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                            />
                          </div>
                        </ClayCard>

                        <ClayCard className="p-6">
                          <h2 className="type-headline text-ink">Application Metadata</h2>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="type-label text-ink">Application Name</label>
                              <input
                                type="text"
                                value={appTitle}
                                onChange={(e) => setAppTitle(e.target.value)}
                                className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                              />
                            </div>
                            <div>
                              <label className="type-label text-ink">Organization</label>
                              <input
                                type="text"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                              />
                            </div>
                          </div>
                        </ClayCard>

                        <div className="flex justify-end">
                          <ClayButton
                            type="submit"
                            variant="primary"
                            disabled={updateMutation.isPending}
                            icon={<Save className="size-4" />}
                          >
                            {updateMutation.isPending ? "Saving..." : "Save Settings"}
                          </ClayButton>
                        </div>
                      </form>
                    </ClayTabsContent>

                    {/* Tab 2: Privacy & Consent */}
                    <ClayTabsContent value="privacy" className="mt-6">
                      <form onSubmit={handleSaveSettings} className="flex flex-col gap-6">
                        <ClayCard className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h2 className="type-headline text-ink">Data Privacy Consent Gate (RA 10173)</h2>
                              <p className="type-body-sm text-ink-muted">
                                Controls the mandatory privacy notice presented to patients before portal access is granted.
                              </p>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1 font-mono type-body-sm text-ink">
                              <span>Version:</span>
                              <span className="font-bold text-olive">{consentVersion}</span>
                            </div>
                          </div>

                          <div className="mt-4">
                            <label className="type-label text-ink">Consent Notice Text</label>
                            <textarea
                              rows={5}
                              required
                              value={consentNoticeText}
                              onChange={(e) => setConsentNoticeText(e.target.value)}
                              className="mt-1 w-full rounded-md border border-hairline bg-surface-2 p-3 type-body text-ink outline-none"
                            />
                          </div>

                          <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-2 p-4">
                            <div>
                              <h3 className="type-headline text-ink">Bump Consent Version</h3>
                              <p className="type-body-sm text-ink-muted">
                                If privacy policy terms have changed, incrementing the version will require all enrolled patients to review and accept the new terms on their next login.
                              </p>
                            </div>
                            <ClayButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              icon={<ShieldAlert className="size-4" />}
                              onClick={handleBumpConsentVersion}
                            >
                              Increment Version
                            </ClayButton>
                          </div>
                        </ClayCard>

                        <div className="flex justify-end">
                          <ClayButton
                            type="submit"
                            variant="primary"
                            disabled={updateMutation.isPending}
                            icon={<Save className="size-4" />}
                          >
                            {updateMutation.isPending ? "Saving..." : "Save Privacy Settings"}
                          </ClayButton>
                        </div>
                      </form>
                    </ClayTabsContent>

                    {/* Tab 3: Care Team Doctors */}
                    <ClayTabsContent value="doctors" className="mt-6">
                      <ClayCard className="p-6">
                        <div className="flex items-center justify-between pb-4">
                          <div>
                            <h2 className="type-headline text-ink">Nephrologists & Fellows</h2>
                            <p className="type-body-sm text-ink-muted">
                              Assigned physicians available during patient enrollment and tracking.
                            </p>
                          </div>
                          <ClayButton
                            variant="primary"
                            size="sm"
                            icon={<Plus className="size-4" />}
                            onClick={() => setShowDoctorDialog(true)}
                          >
                            Add doctor
                          </ClayButton>
                        </div>

                        <div className="mt-4 divide-y divide-hairline">
                          {(doctorsQuery.data ?? []).map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-ink">
                                  <UserCheck className="size-4" />
                                </div>
                                <div>
                                  <p className="font-medium text-ink type-body">{doc.name}</p>
                                  <p className="type-body-sm text-ink-muted">{doc.role}</p>
                                </div>
                              </div>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 type-label ${
                                  doc.active ? "bg-olive-tint text-olive" : "bg-ink-muted/10 text-ink-muted"
                                }`}
                              >
                                {doc.active ? "Active" : "Inactive"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ClayCard>
                    </ClayTabsContent>
                  </ClayTabs>
                </div>

                {/* Add Doctor Dialog */}
                {showDoctorDialog && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <ClayCard className="w-full max-w-md p-6">
                      <h3 className="type-headline text-ink">Add Care Team Member</h3>
                      <form onSubmit={handleAddDoctor} className="mt-4 flex flex-col gap-4">
                        <div>
                          <label className="type-label text-ink">Doctor name *</label>
                          <input
                            type="text"
                            required
                            value={doctorName}
                            onChange={(e) => setDoctorName(e.target.value)}
                            placeholder="e.g. Dr. Maria Santos"
                            className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                          />
                        </div>

                        <div>
                          <label className="type-label text-ink">Role *</label>
                          <select
                            value={doctorRole}
                            onChange={(e) => setDoctorRole(e.target.value as DoctorRole)}
                            className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                          >
                            {DOCTOR_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                          <ClayButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDoctorDialog(false)}
                          >
                            Cancel
                          </ClayButton>
                          <ClayButton
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={createDoctorMutation.isPending}
                          >
                            {createDoctorMutation.isPending ? "Adding..." : "Add doctor"}
                          </ClayButton>
                        </div>
                      </form>
                    </ClayCard>
                  </div>
                )}
              </main>
            </PageTransition>
          </AdminShell>
        </div>
      </AdminToaster>
    </MotionRoot>
  );
}
