import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AdminShell, AdminToaster, useAdminToast } from "@/components/ktp/admin";
import { ClayButton, ClayCard } from "@/components/clay";
import { MotionRoot, OrganGridBackdrop, PageTransition } from "@/components/motion";
import { trpc } from "@/lib/trpc";
import {
  DONOR_STAGES,
  PATIENT_STATUSES,
  PATIENT_TYPES,
  RECIPIENT_STAGES,
  type PatientType,
  type PatientStatus,
  isValidStageForPatientType,
} from "@shared/ktp";

const ADMIN_HREFS = {
  dashboard: "/dashboard",
  patients: "/patients",
  calendar: "/calendar",
  messages: "/messages",
  settings: "/settings",
} as const;

export default function PatientEnrollPage({ id }: { id?: string }) {
  const [, navigate] = useLocation();
  const toast = useAdminToast();
  const editId = id ? parseInt(id, 10) : undefined;

  const [patientType, setPatientType] = useState<PatientType>("Recipient");
  const [hrn, setHrn] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [sex, setSex] = useState<"M" | "F" | "">("M");
  const [birthDate, setBirthDate] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [nephrologistId, setNephrologistId] = useState<number | undefined>();
  const [fellowId, setFellowId] = useState<number | undefined>();
  const [stage, setStage] = useState<string>("Orientation");
  const [riskCategory, setRiskCategory] = useState<"StandardLow" | "High" | "">("");
  const [surgeryDate, setSurgeryDate] = useState("");
  const [linkedRecipientId, setLinkedRecipientId] = useState<number | undefined>();
  const [followupMonths, setFollowupMonths] = useState<number>(1);
  const [status, setStatus] = useState<PatientStatus>("Active");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const doctorsQuery = trpc.doctors.list.useQuery();
  const recipientsQuery = trpc.patients.list.useQuery({ type: "Recipient", status: "Active" });

  const existingQuery = trpc.patients.getById.useQuery(
    { id: editId! },
    {
      enabled: Boolean(editId),
    }
  );

  useEffect(() => {
    document.title = editId ? "Edit patient | KTP" : "Enroll patient | KTP";
  }, [editId]);

  useEffect(() => {
    if (existingQuery.data?.patient) {
      const p = existingQuery.data.patient;
      setPatientType(p.patientType as PatientType);
      setHrn(p.hrn);
      setFirstName(p.firstName);
      setMiddleName(p.middleName ?? "");
      setLastName(p.lastName);
      setSuffix(p.suffix ?? "");
      setSex((p.sex as "M" | "F") ?? "");
      setBirthDate(p.birthDate ? String(p.birthDate).slice(0, 10) : "");
      setContactNumber(p.contactNumber ?? "");
      setAccountEmail(p.accountEmail);
      setNephrologistId(p.nephrologistId ?? undefined);
      setFellowId(p.fellowId ?? undefined);
      setStage(p.stage);
      setRiskCategory((p.riskCategory as "StandardLow" | "High") ?? "");
      setSurgeryDate(p.surgeryDate ? String(p.surgeryDate).slice(0, 10) : "");
      setLinkedRecipientId(p.linkedRecipientId ?? undefined);
      setFollowupMonths(p.followupMonths ?? 1);
      setStatus(p.status as PatientStatus);
    }
  }, [existingQuery.data]);

  // Adjust default stage if type changes and current stage is invalid
  const handleTypeChange = (newType: PatientType) => {
    setPatientType(newType);
    if (!isValidStageForPatientType(stage, newType)) {
      setStage("Orientation");
    }
  };

  const createMutation = trpc.patients.create.useMutation();
  const updateMutation = trpc.patients.update.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const payload = {
      patientType,
      hrn: hrn.trim(),
      firstName: firstName.trim(),
      middleName: middleName.trim() || null,
      lastName: lastName.trim(),
      suffix: suffix.trim() || null,
      sex: sex || null,
      birthDate: birthDate || null,
      contactNumber: contactNumber.trim() || null,
      accountEmail: accountEmail.trim(),
      nephrologistId: nephrologistId || null,
      fellowId: fellowId || null,
      stage,
      riskCategory: riskCategory || null,
      surgeryDate: surgeryDate || null,
      linkedRecipientId: patientType === "Donor" ? linkedRecipientId || null : null,
      followupMonths,
      status,
    };

    try {
      if (editId) {
        await updateMutation.mutateAsync({ id: editId, data: payload as any });
        toast({ title: "Patient updated", body: "Patient profile changes have been saved.", tone: "info" });
        navigate(`/patients/${editId}`);
      } else {
        const created = await createMutation.mutateAsync(payload as any);
        toast({ title: "Patient enrolled", body: "New patient was enrolled successfully.", tone: "info" });
        navigate(`/patients/${created.id}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save patient record.");
    }
  };

  const stagesList = patientType === "Recipient" ? RECIPIENT_STAGES : DONOR_STAGES;
  const isSurgeryRequired = stage === "PostKT" || stage === "PostDonation";
  const nephrologists = (doctorsQuery.data ?? []).filter((d) => d.role === "Nephrologist");
  const fellows = (doctorsQuery.data ?? []).filter((d) => d.role === "Fellow");

  return (
    <MotionRoot intensity="full">
      <AdminToaster>
        <div data-surface="admin" className="relative isolate min-h-dvh bg-ground text-ink">
          <OrganGridBackdrop />
          <AdminShell
            current="patients"
            hrefs={ADMIN_HREFS}
            mobileTitle={editId ? "Edit patient" : "Enroll patient"}
            skipTo="patient-form"
            skipLabel="Skip to patient form"
          >
            <PageTransition routeKey="patient-form" focusHeading={false}>
              <main className="mx-auto w-full max-w-[800px] px-4 pb-16 md:px-6 lg:px-8 lg:pb-20">
                <header className="flex items-center gap-3 pt-4 lg:pt-8">
                  <button
                    type="button"
                    onClick={() => navigate(editId ? `/patients/${editId}` : "/patients")}
                    className="clay-focus rounded-full p-2 text-ink-muted hover:bg-surface-2"
                  >
                    <ArrowLeft className="size-5" />
                  </button>
                  <div>
                    <h1 className="type-display text-ink">
                      {editId ? "Edit patient record" : "Enroll new patient"}
                    </h1>
                    <p className="type-body-sm text-ink-muted">
                      {editId ? "Update patient information and clinical stage" : "Add recipient or living donor to registry"}
                    </p>
                  </div>
                </header>

                <form id="patient-form" onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
                  {errorMsg && (
                    <div className="rounded-lg bg-brick-tint p-4 type-body-sm text-brick">
                      {errorMsg}
                    </div>
                  )}

                  {/* Section 1: Patient Classification */}
                  <ClayCard className="p-6">
                    <h2 className="type-headline text-ink">Classification</h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="type-label text-ink">Patient type *</label>
                        <select
                          value={patientType}
                          onChange={(e) => handleTypeChange(e.target.value as PatientType)}
                          disabled={Boolean(editId)}
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        >
                          <option value="Recipient">Recipient</option>
                          <option value="Donor">Donor</option>
                        </select>
                      </div>

                      <div>
                        <label className="type-label text-ink">HRN (Hospital Record No.) *</label>
                        <input
                          type="text"
                          required
                          value={hrn}
                          onChange={(e) => setHrn(e.target.value)}
                          placeholder="e.g. 1029482"
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 font-mono type-body text-ink outline-none"
                        />
                      </div>
                    </div>

                    {patientType === "Donor" && (
                      <div className="mt-4">
                        <label className="type-label text-ink">Linked Recipient *</label>
                        <select
                          required
                          value={linkedRecipientId ?? ""}
                          onChange={(e) => setLinkedRecipientId(Number(e.target.value) || undefined)}
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        >
                          <option value="">Select linked recipient...</option>
                          {(recipientsQuery.data ?? []).map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.lastName}, {r.firstName} (HRN: {r.hrn})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </ClayCard>

                  {/* Section 2: Personal Information */}
                  <ClayCard className="p-6">
                    <h2 className="type-headline text-ink">Personal Information</h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="type-label text-ink">First name *</label>
                        <input
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        />
                      </div>
                      <div>
                        <label className="type-label text-ink">Middle name</label>
                        <input
                          type="text"
                          value={middleName}
                          onChange={(e) => setMiddleName(e.target.value)}
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        />
                      </div>
                      <div>
                        <label className="type-label text-ink">Last name *</label>
                        <input
                          type="text"
                          required
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        />
                      </div>
                      <div>
                        <label className="type-label text-ink">Suffix</label>
                        <input
                          type="text"
                          value={suffix}
                          onChange={(e) => setSuffix(e.target.value)}
                          placeholder="e.g. Jr., III"
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        />
                      </div>
                      <div>
                        <label className="type-label text-ink">Sex</label>
                        <select
                          value={sex}
                          onChange={(e) => setSex(e.target.value as any)}
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        >
                          <option value="M">Male</option>
                          <option value="F">Female</option>
                        </select>
                      </div>
                      <div>
                        <label className="type-label text-ink">Birth date</label>
                        <input
                          type="date"
                          value={birthDate}
                          onChange={(e) => setBirthDate(e.target.value)}
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        />
                      </div>
                    </div>
                  </ClayCard>

                  {/* Section 3: Contact & Google Account */}
                  <ClayCard className="p-6">
                    <h2 className="type-headline text-ink">Contact & Portal Access</h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="type-label text-ink">Enrolled Gmail account *</label>
                        <input
                          type="email"
                          required
                          value={accountEmail}
                          onChange={(e) => setAccountEmail(e.target.value)}
                          placeholder="patient@gmail.com"
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        />
                        <p className="mt-1 type-body-sm text-ink-muted">
                          Used for Google single sign-on to patient portal.
                        </p>
                      </div>
                      <div>
                        <label className="type-label text-ink">Contact phone number</label>
                        <input
                          type="tel"
                          value={contactNumber}
                          onChange={(e) => setContactNumber(e.target.value)}
                          placeholder="0917-123-4567"
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        />
                      </div>
                    </div>
                  </ClayCard>

                  {/* Section 4: Clinical Tracking */}
                  <ClayCard className="p-6">
                    <h2 className="type-headline text-ink">Clinical Tracking</h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="type-label text-ink">Clinical stage *</label>
                        <select
                          value={stage}
                          onChange={(e) => setStage(e.target.value)}
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        >
                          {stagesList.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="type-label text-ink">
                          {patientType === "Recipient" ? "Transplant date" : "Donation date"}{" "}
                          {isSurgeryRequired && "*"}
                        </label>
                        <input
                          type="date"
                          required={isSurgeryRequired}
                          value={surgeryDate}
                          onChange={(e) => setSurgeryDate(e.target.value)}
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        />
                      </div>

                      <div>
                        <label className="type-label text-ink">Nephrologist</label>
                        <select
                          value={nephrologistId ?? ""}
                          onChange={(e) => setNephrologistId(Number(e.target.value) || undefined)}
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        >
                          <option value="">Select nephrologist...</option>
                          {nephrologists.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="type-label text-ink">Fellow in charge</label>
                        <select
                          value={fellowId ?? ""}
                          onChange={(e) => setFellowId(Number(e.target.value) || undefined)}
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        >
                          <option value="">Select fellow...</option>
                          {fellows.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {patientType === "Recipient" && (
                        <div>
                          <label className="type-label text-ink">Risk category (CDTE)</label>
                          <select
                            value={riskCategory}
                            onChange={(e) => setRiskCategory(e.target.value as any)}
                            className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                          >
                            <option value="">Not evaluated</option>
                            <option value="StandardLow">Standard / Low</option>
                            <option value="High">High</option>
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="type-label text-ink">Follow-up interval (after 1 year)</label>
                        <select
                          value={followupMonths}
                          onChange={(e) => setFollowupMonths(Number(e.target.value))}
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        >
                          <option value={1}>Every 1 month</option>
                          <option value={2}>Every 2 months</option>
                          <option value={3}>Every 3 months</option>
                        </select>
                      </div>

                      <div>
                        <label className="type-label text-ink">Status</label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value as PatientStatus)}
                          className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body text-ink outline-none"
                        >
                          {PATIENT_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </ClayCard>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-2">
                    <ClayButton
                      variant="ghost"
                      type="button"
                      onClick={() => navigate(editId ? `/patients/${editId}` : "/patients")}
                    >
                      Cancel
                    </ClayButton>
                    <ClayButton
                      variant="primary"
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      icon={<Save className="size-4" />}
                    >
                      {createMutation.isPending || updateMutation.isPending
                        ? "Saving..."
                        : editId
                        ? "Update patient"
                        : "Enroll patient"}
                    </ClayButton>
                  </div>
                </form>
              </main>
            </PageTransition>
          </AdminShell>
        </div>
      </AdminToaster>
    </MotionRoot>
  );
}
