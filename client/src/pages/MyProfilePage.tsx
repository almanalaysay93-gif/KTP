import { useState, useEffect } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { NurseAvatar } from "@/components/nursetrack/NurseAvatar";
import { FileUploadButton } from "@/components/nursetrack/FileUpload";
import { CredentialUploadButton } from "@/components/nursetrack/CredentialUploadButton";
import { LicenseStatusBadge, TrainingStatusBadge } from "@/components/nursetrack/StatusBadge";
import { LICENSE_STATUS_META, nurseIdLabel, type LicenseStatus, formatDate } from "@shared/nursetrack";
import { toast } from "sonner";
import { ArrowLeft, FileCheck, LogOut, Plus, Upload, CheckCircle2, Pencil } from "lucide-react";

import StaffLayout from "@/components/StaffLayout";

function StaffShell({ children }: { children: React.ReactNode }) {
  return (
    <StaffLayout>
      <div className="w-full max-w-2xl mx-auto">{children}</div>
    </StaffLayout>
  );
}

/** First-visit banner (claim session): save Gmail, then it locks to Google (D3, D7). */
function ClaimEmailCard({ accountEmail }: { accountEmail: string | null }) {
  const [email, setEmail] = useState("");
  const utils = trpc.useUtils();
  const saveMutation = trpc.staffAccount.saveClaimEmail.useMutation({
    onSuccess: () => {
      toast.success("Saved. Next time, sign in with Google using this Gmail.");
      utils.staffAccount.myProfile.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (accountEmail) {
    return (
      <Card className="glass-card p-4 border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20 space-y-3">
        <div>
          <p className="text-sm font-medium">Next time, sign in with Google using this Gmail.</p>
          <p className="text-sm text-muted-foreground">{accountEmail}</p>
        </div>
        <Button variant="outline" onClick={() => startLogin()}>Continue with Google</Button>
      </Card>
    );
  }

  return (
    <Card className="glass-card p-4 border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20 space-y-3">
      <p className="text-sm font-medium">First visit. Save your Gmail before this session ends.</p>
      <div className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@gmail.com"
        />
        <Button
          disabled={!email.trim() || saveMutation.isPending}
          onClick={() => saveMutation.mutate({ email: email.trim() })}
        >
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </Card>
  );
}

/** Google session only (D6): change the sign-in Gmail. */
function ChangeEmailButton({ currentEmail }: { currentEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const { logout } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const changeMutation = trpc.staffAccount.changeEmail.useMutation({
    onSuccess: async () => {
      toast.success("Sign-in email changed. Your old Google session is closed. Please sign in with your new Gmail.");
      utils.staffAccount.myProfile.setData(undefined, undefined);
      utils.staffAccount.myLink.setData(undefined, undefined);
      setOpen(false);
      setEmail("");
      await logout();
      navigate("/staff-signin");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Change sign-in email
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader className="flex flex-row items-center gap-2 space-y-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="sm:hidden h-8 px-2 -ml-2 text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
              onClick={() => setOpen(false)}
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Back</span>
            </Button>
            <DialogTitle>Change sign-in email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Current: {currentEmail ?? "—"}</p>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="new-address@gmail.com"
            />
            <Button
              className="w-full"
              disabled={!email.trim() || changeMutation.isPending}
              onClick={() => changeMutation.mutate({ email: email.trim() })}
            >
              {changeMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddTrainingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const utils = trpc.useUtils();
  const { data: catalog } = trpc.staffAccount.listCatalog.useQuery(undefined, { enabled: open });
  const [trainingId, setTrainingId] = useState("");
  const [provider, setProvider] = useState("");
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().slice(0, 10));
  const [trainingHours, setTrainingHours] = useState("");
  const [cpdUnits, setCpdUnits] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  const addMutation = trpc.staffAccount.addTrainingRecord.useMutation({
    onSuccess: () => {
      toast.success("Training completion recorded.");
      utils.staffAccount.myProfile.invalidate();
      onOpenChange(false);
      setTrainingId("");
      setProvider("");
      setTrainingHours("");
      setCpdUnits("");
      setCertNumber("");
      setRemarks("");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader className="flex flex-row items-center gap-2 space-y-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="sm:hidden h-8 px-2 -ml-2 text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          <DialogTitle>Add Completed Training or Seminar</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="col-span-1 sm:col-span-2">
            <Label className="mb-1 block">Training Topic *</Label>
            <Select value={trainingId} onValueChange={setTrainingId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select topic from catalog…" />
              </SelectTrigger>
              <SelectContent>
                {(catalog ?? []).map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name} ({item.kind})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Completion Date *</Label>
            <Input
              type="date"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block">Training Provider</Label>
            <Input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. SPMC / DOH / PRC"
            />
          </div>
          <div>
            <Label className="mb-1 block">Training Hours</Label>
            <Input
              type="number"
              min={1}
              value={trainingHours}
              onChange={(e) => setTrainingHours(e.target.value)}
              placeholder="e.g. 8"
            />
          </div>
          <div>
            <Label className="mb-1 block">CPD Units</Label>
            <Input
              type="number"
              min={0}
              value={cpdUnits}
              onChange={(e) => setCpdUnits(e.target.value)}
              placeholder="e.g. 5"
            />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <Label className="mb-1 block">Certificate Number</Label>
            <Input
              value={certNumber}
              onChange={(e) => setCertNumber(e.target.value)}
              placeholder="e.g. CERT-2026-001"
            />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <Label className="mb-1 block">Remarks / Notes</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes or details…"
            />
          </div>
          <div className="col-span-1 sm:col-span-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              disabled={!trainingId || !completionDate || addMutation.isPending}
              onClick={() => {
                addMutation.mutate({
                  trainingId: Number(trainingId),
                  completionDate,
                  provider: provider.trim() || undefined,
                  trainingHours: trainingHours ? Number(trainingHours) : undefined,
                  cpdUnits: cpdUnits ? Number(cpdUnits) : undefined,
                  certificateNumber: certNumber.trim() || undefined,
                  remarks: remarks.trim() || undefined,
                });
              }}
            >
              {addMutation.isPending ? "Saving..." : "Save Record"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditPrcDetailsDialog({
  open,
  onOpenChange,
  credentialId,
  initialValues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credentialId?: number;
  initialValues: {
    licenseNumber?: string | null;
    issueDate?: string | Date | null;
    expiryDate?: string | Date | null;
  };
}) {
  const utils = trpc.useUtils();
  const [licenseNumber, setLicenseNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const toDateInputStr = (val: string | Date | null | undefined): string => {
    if (!val) return "";
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? "" : val.toISOString().slice(0, 10);
    }
    const str = String(val).trim();
    const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(str);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (open) {
      setLicenseNumber(initialValues.licenseNumber ?? "");
      setIssueDate(toDateInputStr(initialValues.issueDate));
      setExpiryDate(toDateInputStr(initialValues.expiryDate));
    }
  }, [open, initialValues.licenseNumber, initialValues.issueDate, initialValues.expiryDate]);

  const saveMutation = trpc.staffAccount.updateMyPrcLicense.useMutation({
    onSuccess: () => {
      toast.success("PRC license details updated.");
      utils.staffAccount.myProfile.invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    if (expiryDate === "") {
      toast.error("Expiry date is required.");
      return;
    }
    if (issueDate && expiryDate) {
      const d1 = new Date(issueDate);
      const d2 = new Date(expiryDate);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d1 > d2) {
        toast.error("Issue date cannot be after expiry date.");
        return;
      }
    }
    saveMutation.mutate({
      credentialId,
      licenseNumber: licenseNumber.trim() || null,
      issueDate: issueDate || null,
      expiryDate: expiryDate || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex flex-row items-center gap-2 space-y-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="sm:hidden h-8 px-2 -ml-2 text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          <DialogTitle>Enter PRC License Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label htmlFor="manual-prc-number" className="text-xs font-semibold">
              PRC License Number
            </Label>
            <Input
              id="manual-prc-number"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="e.g. 0123456"
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Preserves leading zeros (e.g. 0123456).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="manual-issue-date" className="text-xs font-semibold">
                Issue Date
              </Label>
              <Input
                id="manual-issue-date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="manual-expiry-date" className="text-xs font-semibold">
                Expiry Date
              </Label>
              <Input
                id="manual-expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Changes to license details will mark the credential as Pending Verification until reviewed by a supervisor.
          </p>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-1.5"
            >
              {saveMutation.isPending ? "Saving..." : "Save details"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MyProfileView({ profile }: { profile: any }) {
  const utils = trpc.useUtils();
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [contactNumber, setContactNumber] = useState<string | null>(null);
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);
  const [prcDetailsDialogOpen, setPrcDetailsDialogOpen] = useState(false);
  const [selectedPrcCred, setSelectedPrcCred] = useState<any>(null);

  const prcCred = profile.credentials?.find((c: any) => c.typeName?.toLowerCase().includes("prc")) || profile.credentials?.[0];

  const saveMutation = trpc.staffAccount.updateMyBasicInfo.useMutation({
    onSuccess: () => {
      toast.success("Contact info saved.");
      utils.staffAccount.myProfile.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const photoMutation = trpc.staffAccount.uploadMyPhoto.useMutation({
    onSuccess: () => {
      toast.success("Profile photo updated.");
      utils.staffAccount.myProfile.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const credDocMutation = trpc.staffAccount.uploadCredentialDocument.useMutation({
    onSuccess: () => {
      toast.success("License document uploaded.");
      utils.staffAccount.myProfile.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const certUploadMutation = trpc.staffAccount.uploadTrainingCertificate.useMutation({
    onSuccess: () => {
      toast.success("Training certificate uploaded.");
      utils.staffAccount.myProfile.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const currentContact = contactNumber ?? profile.contactNumber ?? "";

  return (
    <div className="space-y-4">
      {profile.authMode === "claim" ? <ClaimEmailCard accountEmail={profile.accountEmail} /> : null}

      <Card className="glass-card p-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <NurseAvatar nurse={profile} size="xl" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">
              {profile.firstName} {profile.middleName ? `${profile.middleName} ` : ""}{profile.lastName} {profile.suffix ?? ""}
            </h1>
            <p className="text-sm text-muted-foreground">{nurseIdLabel(profile)} &middot; {profile.position || profile.staffType}</p>
            <p className="text-sm text-muted-foreground">{profile.currentArea?.name ?? "Unassigned"}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <FileUploadButton
            kind="photo"
            label="Change photo"
            disabled={photoMutation.isPending}
            onFile={(file) => photoMutation.mutate(file)}
          />
          {profile.authMode === "google" ? <ChangeEmailButton currentEmail={profile.accountEmail} /> : null}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await logout();
              utils.staffAccount.myProfile.invalidate();
              setLocation("/staff-signin");
            }}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto flex items-center gap-1.5"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </Button>
        </div>
      </Card>

      <Card className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="font-semibold text-base">PRC License</h2>
            <p className="text-xs text-muted-foreground">Professional Regulation Commission</p>
          </div>
          <div className="flex items-center gap-2">
            {profile.licenseStatus ? (
              <LicenseStatusBadge
                status={profile.licenseStatus as never}
                licenseNumber={profile.licenseNumber}
                showPrefix
              />
            ) : (
              <Badge variant="outline">No license on file</Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedPrcCred(prcCred ?? null);
                setPrcDetailsDialogOpen(true);
              }}
              className="flex items-center gap-1.5 ml-2"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Details</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t text-sm">
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground">License Number</span>
            <p className="font-mono font-medium text-foreground">{profile.licenseNumber || "—"}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground">Issue Date</span>
            <p className="text-foreground">{formatDate(prcCred?.issueDate) || "—"}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground">Expiry Date</span>
            <p className="text-foreground">{formatDate(profile.licenseExpiryDate) || "—"}</p>
          </div>
        </div>
      </Card>

      <Card className="glass-card p-6 space-y-3">
        <h2 className="font-semibold">Contact number</h2>
        <div className="flex gap-2">
          <Input
            value={currentContact}
            onChange={(e) => setContactNumber(e.target.value)}
            placeholder="e.g. 09171234567"
          />
          <Button
            disabled={saveMutation.isPending || currentContact === (profile.contactNumber ?? "")}
            onClick={() => saveMutation.mutate({ contactNumber: currentContact || undefined })}
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </Card>

      <Card className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Licenses & Credentials</h2>
        </div>
        {profile.credentials.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No credentials recorded.</p>
        ) : (
          <div className="space-y-3">
            {profile.credentials.map((c: any) => {
              const isPrc = Boolean(c.typeName?.toLowerCase().includes("prc"));
              return (
                <div key={c.id} className="p-3 border rounded-lg bg-card/40 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1 min-w-48">
                    <div className="font-medium text-sm">{c.typeName}</div>
                    <div className="text-xs text-muted-foreground">
                      Number: <span className="font-mono">{c.licenseNumber || "—"}</span> &middot; Expires: {formatDate(c.expiryDate)}
                    </div>
                    {c.documentKey && (
                      <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Document on file</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isPrc && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPrcCred(c);
                          setPrcDetailsDialogOpen(true);
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit Details</span>
                      </Button>
                    )}
                    <CredentialUploadButton
                      credential={{
                        id: c.id,
                        typeName: c.typeName,
                        licenseNumber: c.licenseNumber,
                        issueDate: c.issueDate,
                        expiryDate: c.expiryDate,
                        nurseName: profile?.firstName ? `${profile.firstName} ${profile.lastName}` : undefined,
                      }}
                      label={c.documentKey ? "Replace Document" : "Upload Document"}
                      disabled={credDocMutation.isPending}
                      onUpload={async ({ file, confirmedFields }) => {
                        await credDocMutation.mutateAsync({
                          credentialId: c.id,
                          fileBase64: file.fileBase64,
                          fileName: file.fileName,
                          mimeType: file.mimeType,
                          confirmedFields,
                        });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <EditPrcDetailsDialog
        open={prcDetailsDialogOpen}
        onOpenChange={(v) => {
          setPrcDetailsDialogOpen(v);
          if (!v) setSelectedPrcCred(null);
        }}
        credentialId={selectedPrcCred?.id ?? prcCred?.id}
        initialValues={{
          licenseNumber: selectedPrcCred?.licenseNumber ?? profile.licenseNumber,
          issueDate: selectedPrcCred?.issueDate ?? prcCred?.issueDate,
          expiryDate: selectedPrcCred?.expiryDate ?? profile.licenseExpiryDate,
        }}
      />

      <Card className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Trainings & Seminars</h2>
          <Button size="sm" variant="outline" onClick={() => setTrainingDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Training
          </Button>
        </div>
        {profile.trainings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No training records on file yet.</p>
        ) : (
          <div className="space-y-3">
            {profile.trainings.map((t: any) => (
              <div key={t.id} className="p-3 border rounded-lg bg-card/40 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 min-w-48">
                  <div className="font-medium text-sm">{t.trainingName}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.provider ? `${t.provider} · ` : ""}Completed: {formatDate(t.completionDate)}
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <TrainingStatusBadge status={t.status} />
                    {t.certificateKey && (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3" /> Certificate on file
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FileUploadButton
                    kind="document"
                    label={t.certificateKey ? "Replace Certificate" : "Upload Certificate"}
                    disabled={certUploadMutation.isPending}
                    onFile={(f) => certUploadMutation.mutate({ recordId: t.id, ...f })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <AddTrainingDialog open={trainingDialogOpen} onOpenChange={setTrainingDialogOpen} />
    </div>
  );
}

export default function MyProfilePage() {
  const profileQuery = trpc.staffAccount.myProfile.useQuery(undefined, { retry: false });

  if (profileQuery.error?.data?.code === "UNAUTHORIZED") {
    return <Redirect to="/staff-signin" />;
  }

  return (
    <StaffShell>
      {profileQuery.error ? (
        <Card className="glass-card p-6 space-y-3" role="alert">
          <p className="text-sm font-medium text-destructive">Could not load your profile. Please try again.</p>
          <Button size="sm" onClick={() => void profileQuery.refetch()}>Retry</Button>
        </Card>
      ) : profileQuery.isLoading || !profileQuery.data ? (
        <div className="space-y-4">
          <Card className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </Card>
          <Card className="glass-card p-6 space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-6 w-40" />
          </Card>
          <Card className="glass-card p-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
          </Card>
        </div>
      ) : (
        <MyProfileView profile={profileQuery.data} />
      )}
    </StaffShell>
  );
}
