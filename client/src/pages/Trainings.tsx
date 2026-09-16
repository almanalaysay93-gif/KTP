import { FileUploadButton } from "@/components/nursetrack/FileUpload";
import { TrainingStatusBadge } from "@/components/nursetrack/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { formatDate, nurseFullName, TRAINING_KINDS } from "../../../shared/nursetrack";
import {
  BookOpen,
  Plus,
  Trash2,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  Mail,
  RefreshCw,
  FileCheck,
  Check,
  X,
  Clock,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const RECORD_STATUSES = ["Scheduled", "Completed", "Expired", "Cancelled"] as const;

export default function Trainings() {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editCatalogId, setEditCatalogId] = useState<number | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [editRecordId, setEditRecordId] = useState<number | null>(null);
  const [certUploadId, setCertUploadId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  // Single round-trip: server merges catalog + records.
  const { data: initial, isLoading } = trpc.trainings.initial.useQuery(undefined, {
    placeholderData: (prev) => prev,
  });
  const catalog = initial?.catalog;
  const records = initial?.records;
  const catalogLoading = isLoading;
  const recordsLoading = isLoading;

  const toggleActive = trpc.trainings.updateCatalogItem.useMutation({
    onSuccess: () => {
      toast.success("Catalog item updated.");
      utils.trainings.listCatalog.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if ((catalogLoading || recordsLoading) && !initial) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trainings</h1>
          <p className="text-sm text-muted-foreground">Catalog of training types and recorded training events</p>
        </div>
      </div>

      <Tabs defaultValue="records" className="w-full">
        <TabsList>
          <TabsTrigger value="records">Training Records ({records?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="followup">Follow-up & Reminders</TabsTrigger>
          <TabsTrigger value="catalog">Catalog ({catalog?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="followup">
          <FollowUpTab />
        </TabsContent>

        <TabsContent value="records">
          <RecordsTab
            records={records ?? []}
            onAdd={() => {
              setEditRecordId(null);
              setRecordOpen(true);
            }}
            onEdit={(id) => {
              setEditRecordId(id);
              setRecordOpen(true);
            }}
            onUploadCert={(id) => setCertUploadId(id)}
            certUploadId={certUploadId}
            setCertUploadId={setCertUploadId}
            utils={utils}
          />
        </TabsContent>

        <TabsContent value="catalog">
        <CatalogTab
          catalog={catalog ?? []}
          onAdd={() => {
            setEditCatalogId(null);
            setCatalogOpen(true);
          }}
          onEditCatalog={(cid) => {
            setEditCatalogId(cid);
            setCatalogOpen(true);
          }}
          onToggleActive={(cid, active) => toggleActive.mutate({ id: cid, active: !active })}
          utils={utils}
        />
        </TabsContent>
      </Tabs>

      {catalogOpen && (
        <CatalogDialog
          open={catalogOpen}
          onOpenChange={(v) => {
            setCatalogOpen(v);
            if (!v) setEditCatalogId(null);
          }}
          itemId={editCatalogId}
          catalog={catalog ?? []}
          utils={utils}
        />
      )}

      {recordOpen && (
        <TrainingRecordDialog
          open={recordOpen}
          onOpenChange={setRecordOpen}
          recordId={editRecordId}
          utils={utils}
          catalog={catalog ?? []}
        />
      )}
    </div>
  );
}

function RecordsTab({
  records,
  onAdd,
  onEdit,
  onUploadCert,
  certUploadId,
  setCertUploadId,
  utils,
}: {
  records: {
    id: number;
    nurseId: number;
    nurseName?: string;
    trainingName?: string;
    trainingId: number;
    status: string;
    derivedStatus?: string;
    provider?: string | null;
    scheduledDate?: Date | string | null;
    completionDate?: Date | string | null;
    expiryDate?: Date | string | null;
    trainingHours?: number | null;
    cpdUnits?: number | null;
    certificateNumber?: string | null;
    certificateKey?: string | null;
    remarks?: string | null;
  }[];
  onAdd: () => void;
  onEdit: (id: number) => void;
  onUploadCert: (id: number) => void;
  certUploadId: number | null;
  setCertUploadId: (id: number | null) => void;
  utils: ReturnType<typeof trpc.useUtils>;
}) {
  const upload = trpc.trainings.uploadCertificate.useMutation({
    onSuccess: () => {
      toast.success("Certificate uploaded.");
      utils.trainings.listRecords.invalidate();
      setCertUploadId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const mark = trpc.trainings.updateRecord.useMutation({
    onSuccess: () => {
      toast.success("Record updated.");
      utils.trainings.listRecords.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const [recordToDelete, setRecordToDelete] = useState<(typeof records)[number] | null>(null);
  const remove = trpc.trainings.deleteRecord.useMutation({
    onSuccess: async () => {
      toast.success("Training record deleted.");
      await Promise.all([
        utils.trainings.initial.invalidate(),
        utils.trainings.listRecords.invalidate(),
        utils.trainings.listForNurse.invalidate(),
        utils.trainings.getCompliance.invalidate(),
        utils.seminars.list.invalidate(),
        utils.seminars.detail.invalidate(),
        utils.seminars.matrix.invalidate(),
        utils.seminars.monthlySummary.invalidate(),
        utils.seminars.quarterlyLedger.invalidate(),
        utils.calendar.listEvents.invalidate(),
        utils.dashboard.initial.invalidate(),
      ]);
      setRecordToDelete(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [subset, setSubset] = useState<"upcoming" | "completed" | "expiring" | "all">("all");

  const today = new Date().toISOString().slice(0, 10);
  const filtered = records.filter((r) => {
    if (subset === "upcoming") return r.status === "Scheduled";
    if (subset === "completed") return r.status === "Completed";
    if (subset === "expiring") return r.expiryDate && new Date(r.expiryDate).toISOString().slice(0, 10) <= new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10) && r.status !== "Cancelled";
    return true;
  });

  const target = records.find((r) => r.id === certUploadId);

  return (
    <>
      <Card className="glass-card">
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap gap-1">
            {([
              ["all", "All"],
              ["upcoming", "Upcoming"],
              ["completed", "Completed"],
              ["expiring", "Expiring ≤90d"],
            ] as const).map(([k, label]) => (
              <Button
                key={k}
                variant={subset === k ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSubset(k)}
              >
                {label}
              </Button>
            ))}
          </div>
          <Button size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add Training Record
          </Button>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {records.length === 0 ? "No training records yet." : "No records match this subset."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-2.5 font-medium">Nurse</th>
                  <th className="px-3 py-2.5 font-medium">Training</th>
                  <th className="px-3 py-2.5 font-medium">Provider</th>
                  <th className="px-3 py-2.5 font-medium">Scheduled</th>
                  <th className="px-3 py-2.5 font-medium">Completed</th>
                  <th className="px-3 py-2.5 font-medium">Expires</th>
                  <th className="px-3 py-2.5 font-medium">Hours</th>
                  <th className="px-3 py-2.5 font-medium">CPD</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2.5">{r.nurseName ?? `#${r.nurseId}`}</td>
                    <td className="px-3 py-2.5">{r.trainingName ?? `#${r.trainingId}`}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.provider ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatDate(r.scheduledDate)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatDate(r.completionDate)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatDate(r.expiryDate)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.trainingHours ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.cpdUnits ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <TrainingStatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(r.id)}
                        >
                          Edit
                        </Button>
                        {r.status === "Completed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => mark.mutate({ id: r.id, status: "Expired" })}
                          >
                            Expire
                          </Button>
                        )}
                        <FileUploadButton
                          kind="document"
                          label={target?.id === r.id ? "Uploading…" : "Upload Cert"}
                          disabled={upload.isPending}
                          onFile={(f) => upload.mutate({ recordId: r.id, ...f })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${r.trainingName ?? "training"} record`}
                          title="Delete training record"
                          onClick={() => setRecordToDelete(r)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      </Card>
      <AlertDialog open={Boolean(recordToDelete)} onOpenChange={(open) => !open && setRecordToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Training Record Permanently?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Delete <strong>{recordToDelete?.trainingName ?? "this training"}</strong> for {recordToDelete?.nurseName ?? `staff #${recordToDelete?.nurseId}`}?
              </span>
              <span className="block text-xs text-muted-foreground">
                This removes this training history record. This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={() => recordToDelete && remove.mutate({ id: recordToDelete.id })}
            >
              {remove.isPending ? "Deleting..." : "Permanently Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CatalogTab({
  catalog,
  onAdd,
  onEditCatalog,
  onToggleActive,
  utils,
}: {
  catalog: {
    id: number;
    name: string;
    kind?: string;
    defaultValidityMonths?: number | null;
    category?: string | null;
    renewalRequired: boolean;
    active: boolean;
  }[];
  onAdd: () => void;
  onEditCatalog: (id: number) => void;
  onToggleActive: (id: number, currentlyActive: boolean) => void;
  utils: ReturnType<typeof trpc.useUtils>;
}) {
  const [catalogToDelete, setCatalogToDelete] = useState<(typeof catalog)[number] | null>(null);
  const deleteCatalogMutation = trpc.trainings.deleteCatalogItem.useMutation({
    onSuccess: async () => {
      toast.success(`${catalogToDelete?.kind ?? "Catalog item"} deleted.`);
      await Promise.all([
        utils.trainings.initial.invalidate(),
        utils.trainings.listCatalog.invalidate(),
        utils.trainings.listRecords.invalidate(),
        utils.trainings.listForNurse.invalidate(),
        utils.trainings.getCompliance.invalidate(),
        utils.seminars.list.invalidate(),
        utils.seminars.detail.invalidate(),
        utils.seminars.matrix.invalidate(),
        utils.seminars.monthlySummary.invalidate(),
        utils.seminars.quarterlyLedger.invalidate(),
        utils.calendar.listEvents.invalidate(),
        utils.dashboard.initial.invalidate(),
      ]);
      setCatalogToDelete(null);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <Card className="glass-card">
        <CardContent className="pt-5">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Add to Catalog
            </Button>
          </div>
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No training types in the catalog.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {catalog.map((c) => (
                <div key={c.id} className={"border rounded-lg p-3.5 flex flex-col justify-between" + (!c.active ? " opacity-60" : "")}>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {c.kind ? <span className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-0.5 block">{c.kind}</span> : null}
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[c.category, c.defaultValidityMonths ? `valid ${c.defaultValidityMonths} mo` : null].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    {c.renewalRequired && (
                      <p className="mt-2 text-xs font-medium text-[#B4700A] dark:text-[#FBBF24]">Renewal required</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => onEditCatalog(c.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs hover:underline"
                        onClick={() => onToggleActive(c.id, c.active)}
                      >
                        {c.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline flex items-center gap-1"
                      onClick={() => setCatalogToDelete(c)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={Boolean(catalogToDelete)} onOpenChange={(open) => !open && setCatalogToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete {catalogToDelete?.kind ?? "Training"} Catalog Item?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Delete <strong>{catalogToDelete?.name}</strong> ({catalogToDelete?.kind ?? "Training"})?
              </span>
              <span className="block text-xs text-muted-foreground">
                This permanently deletes this {catalogToDelete?.kind ?? "training"} from the catalog, including any scheduled seminar occurrences and all linked attendance records. This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCatalogMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCatalogMutation.isPending}
              onClick={() => catalogToDelete && deleteCatalogMutation.mutate({ id: catalogToDelete.id })}
            >
              {deleteCatalogMutation.isPending ? "Deleting..." : "Permanently Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CatalogDialog({
  open,
  onOpenChange,
  utils,
  itemId,
  catalog,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  utils: ReturnType<typeof trpc.useUtils>;
  itemId?: number | null;
  catalog?: { id: number; name: string; category?: string | null; kind: (typeof TRAINING_KINDS)[number]; renewalRequired: boolean; defaultValidityMonths?: number | null }[];
}) {
  const isEdit = Boolean(itemId);
  const existing = catalog?.find((c) => c.id === itemId);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState<(typeof TRAINING_KINDS)[number]>("Training");
  const [renewalRequired, setRenewalRequired] = useState(false);
  const [months, setMonths] = useState("");
  const [loaded, setLoaded] = useState(false);

  if (open && isEdit && existing && !loaded) {
    setName(existing.name);
    setCategory(existing.category ?? "");
    setKind(existing.kind);
    setRenewalRequired(existing.renewalRequired);
    setMonths(existing.defaultValidityMonths != null ? String(existing.defaultValidityMonths) : "");
    setLoaded(true);
  }
  if (open && !isEdit && !loaded) {
    setLoaded(true);
  }

  const reset = () => {
    setName("");
    setCategory("");
    setKind("Training");
    setRenewalRequired(false);
    setMonths("");
    setLoaded(false);
  };

  const create = trpc.trainings.createCatalogItem.useMutation({
    onSuccess: () => {
      toast.success("Training type added to catalog.");
      utils.trainings.listCatalog.invalidate();
      onOpenChange(false);
      reset();
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.trainings.updateCatalogItem.useMutation({
    onSuccess: () => {
      toast.success("Training type updated.");
      utils.trainings.listCatalog.invalidate();
      onOpenChange(false);
      reset();
    },
    onError: (e) => toast.error(e.message),
  });

  const submitting = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Training Type" : "Add Training Type"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label className="mb-1 block">Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Basic Life Support" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block">Activity Type</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as (typeof TRAINING_KINDS)[number])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TRAINING_KINDS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block">Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., Clinical" />
            </div>
            <div>
              <Label className="mb-1 block">Default Validity (months)</Label>
              <Input
                type="number"
                min={1}
                max={600}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={renewalRequired} onCheckedChange={setRenewalRequired} />
            <Label>Renewal required</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>Cancel</Button>
            <Button
              disabled={submitting || !name.trim()}
              onClick={() => {
                if (isEdit && itemId) {
                  update.mutate({
                    id: itemId,
                    name: name.trim(),
                    category: category.trim() || null,
                    kind,
                    renewalRequired,
                    defaultValidityMonths: months ? Number(months) : null,
                  });
                } else {
                  create.mutate({
                    name: name.trim(),
                    category: category.trim() || undefined,
                    kind,
                    renewalRequired,
                    defaultValidityMonths: months ? Number(months) : undefined,
                  });
                }
              }}
            >
              {isEdit ? "Save Changes" : "Add"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TrainingRecordDialog({
  open,
  onOpenChange,
  recordId,
  utils,
  catalog,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recordId: number | null;
  utils: ReturnType<typeof trpc.useUtils>;
  catalog: { id: number; name: string; defaultValidityMonths?: number | null }[];
}) {
  const [, navigate] = useLocation();
  const [nurseId, setNurseId] = useState("");
  const [trainingId, setTrainingId] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("Scheduled");
  const [scheduledDate, setScheduledDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [hours, setHours] = useState("");
  const [cpd, setCpd] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  const existing = recordId ? undefined : undefined;

  const create = trpc.trainings.createRecord.useMutation({
    onSuccess: () => {
      toast.success("Training record added.");
      utils.trainings.listRecords.invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.trainings.updateRecord.useMutation({
    onSuccess: () => {
      toast.success("Training record updated.");
      utils.trainings.listRecords.invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const valid = recordId || (nurseId.trim() && trainingId.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recordId ? "Edit Training Record" : "Add Training Record"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          {!recordId && (
            <div>
              <Label className="mb-1 block">Nurse ID (numeric) *</Label>
              <Input
                type="number"
                min={1}
                value={nurseId}
                onChange={(e) => setNurseId(e.target.value)}
                placeholder="e.g., 1"
              />
              <button
                type="button"
                className="text-xs text-primary underline mt-1"
                onClick={() => navigate("/nurses")}
              >
                Find a nurse
              </button>
            </div>
          )}
          <div className={recordId ? "col-span-2" : undefined}>
            <Label className="mb-1 block">Training Type *</Label>
            <Select value={trainingId} onValueChange={setTrainingId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select training…" /></SelectTrigger>
              <SelectContent>
                {catalog.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECORD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Provider</Label>
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g., SKTI HRD" />
          </div>
          <div>
            <Label className="mb-1 block">Scheduled Date</Label>
            <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Completion Date</Label>
            <Input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Expiry Date</Label>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block">Training Hours</Label>
              <Input type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block">CPD Units</Label>
              <Input type="number" min={1} value={cpd} onChange={(e) => setCpd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="mb-1 block">Certificate Number</Label>
            <Input value={certNumber} onChange={(e) => setCertNumber(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="mb-1 block">Remarks</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              disabled={create.isPending || update.isPending || !valid}
              onClick={() => {
                const data = {
                  trainingId: Number(trainingId),
                  provider: provider.trim() || undefined,
                  status: status as never,
                  scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                  completionDate: completionDate ? new Date(completionDate) : undefined,
                  expiryDate: expiryDate ? new Date(expiryDate) : undefined,
                  trainingHours: hours ? Number(hours) : undefined,
                  cpdUnits: cpd ? Number(cpd) : undefined,
                  certificateNumber: certNumber.trim() || undefined,
                  remarks: remarks.trim() || undefined,
                };
                if (recordId) update.mutate({ id: recordId, ...data });
                else create.mutate({ nurseId: Number(nurseId), ...data });
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FollowUpTab() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<
    "all" | "pending_response" | "cannot_attend" | "missing_email" | "delivery_failed" | "evidence_review" | "missed"
  >("all");

  const { data, isLoading } = trpc.trainings.followUpList.useQuery({ filter });

  const recordAttendanceMutation = trpc.trainings.recordAttendance.useMutation({
    onSuccess: () => {
      toast.success("Attendance outcome recorded");
      utils.trainings.followUpList.invalidate();
      utils.trainings.initial.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to record attendance"),
  });

  const reviewEvidenceMutation = trpc.trainings.reviewEvidence.useMutation({
    onSuccess: () => {
      toast.success("Evidence review saved");
      utils.trainings.followUpList.invalidate();
      utils.trainings.initial.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to review evidence"),
  });

  const items = data?.items ?? [];
  const counts = data?.counts ?? {
    total: 0,
    pendingResponse: 0,
    cannotAttend: 0,
    missingEmail: 0,
    evidenceReview: 0,
    missed: 0,
  };

  return (
    <div className="space-y-4">
      {/* Metric summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card
          onClick={() => setFilter("all")}
          className={`glass-card p-3 cursor-pointer transition ${filter === "all" ? "border-primary ring-1 ring-primary" : "hover:border-slate-300"}`}
        >
          <span className="text-[11px] text-muted-foreground block">Total Assigned</span>
          <span className="text-xl font-bold text-foreground">{counts.total}</span>
        </Card>
        <Card
          onClick={() => setFilter("pending_response")}
          className={`glass-card p-3 cursor-pointer transition ${filter === "pending_response" ? "border-amber-500 ring-1 ring-amber-500" : "hover:border-slate-300"}`}
        >
          <span className="text-[11px] text-muted-foreground block">Pending Response</span>
          <span className="text-xl font-bold text-amber-600">{counts.pendingResponse}</span>
        </Card>
        <Card
          onClick={() => setFilter("cannot_attend")}
          className={`glass-card p-3 cursor-pointer transition ${filter === "cannot_attend" ? "border-rose-500 ring-1 ring-rose-500" : "hover:border-slate-300"}`}
        >
          <span className="text-[11px] text-muted-foreground block">Cannot Attend</span>
          <span className="text-xl font-bold text-rose-600">{counts.cannotAttend}</span>
        </Card>
        <Card
          onClick={() => setFilter("evidence_review")}
          className={`glass-card p-3 cursor-pointer transition ${filter === "evidence_review" ? "border-sky-500 ring-1 ring-sky-500" : "hover:border-slate-300"}`}
        >
          <span className="text-[11px] text-muted-foreground block">Evidence to Review</span>
          <span className="text-xl font-bold text-sky-600">{counts.evidenceReview}</span>
        </Card>
        <Card
          onClick={() => setFilter("missing_email")}
          className={`glass-card p-3 cursor-pointer transition ${filter === "missing_email" ? "border-slate-500 ring-1 ring-slate-500" : "hover:border-slate-300"}`}
        >
          <span className="text-[11px] text-muted-foreground block">Missing Email</span>
          <span className="text-xl font-bold text-slate-600">{counts.missingEmail}</span>
        </Card>
      </div>

      {/* Filter Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          className="text-xs h-7"
          onClick={() => setFilter("all")}
        >
          All ({counts.total})
        </Button>
        <Button
          size="sm"
          variant={filter === "pending_response" ? "default" : "outline"}
          className="text-xs h-7"
          onClick={() => setFilter("pending_response")}
        >
          Pending Response ({counts.pendingResponse})
        </Button>
        <Button
          size="sm"
          variant={filter === "cannot_attend" ? "default" : "outline"}
          className="text-xs h-7"
          onClick={() => setFilter("cannot_attend")}
        >
          Cannot Attend ({counts.cannotAttend})
        </Button>
        <Button
          size="sm"
          variant={filter === "evidence_review" ? "default" : "outline"}
          className="text-xs h-7"
          onClick={() => setFilter("evidence_review")}
        >
          Evidence Awaiting Review ({counts.evidenceReview})
        </Button>
        <Button
          size="sm"
          variant={filter === "missed" ? "default" : "outline"}
          className="text-xs h-7"
          onClick={() => setFilter("missed")}
        >
          Missed ({counts.missed})
        </Button>
      </div>

      {/* Roster Table */}
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : items.length === 0 ? (
        <Card className="glass-card p-8 text-center text-xs text-muted-foreground">
          No training assignments match the selected filter.
        </Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
              <tr>
                <th className="p-3">Staff Nurse</th>
                <th className="p-3">Training & Schedule</th>
                <th className="p-3">Nurse Response</th>
                <th className="p-3">Attendance Outcome</th>
                <th className="p-3">Evidence</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it: any) => (
                <tr key={it.assignmentId} className="hover:bg-muted/30 transition">
                  <td className="p-3">
                    <div className="font-semibold text-foreground">{it.nurseName}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <span>ID: {it.employeeId || "—"}</span>
                      {!it.hasEmail ? (
                        <span className="text-amber-600 font-medium">(No email)</span>
                      ) : (
                        <span className="truncate max-w-[140px]" title={it.accountEmail}>
                          {it.accountEmail}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-3">
                    <div className="font-medium text-foreground">{it.trainingName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {it.startDateStr}
                      {it.startTime ? ` at ${it.startTime}` : ""}
                    </div>
                  </td>

                  <td className="p-3">
                    {it.staffResponse === "Confirmed" ? (
                      <Badge className="bg-teal-600 text-white text-[10px]">Confirmed</Badge>
                    ) : it.staffResponse === "Cannot attend" ? (
                      <div>
                        <Badge className="bg-rose-600 text-white text-[10px]">Cannot Attend</Badge>
                        {it.staffResponseReason && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1" title={it.staffResponseReason}>
                            {it.staffResponseReason}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                        Pending
                      </Badge>
                    )}
                  </td>

                  <td className="p-3">
                    <Select
                      value={it.attendanceOutcome || "not_recorded"}
                      onValueChange={(val) =>
                        recordAttendanceMutation.mutate({
                          assignmentId: it.assignmentId,
                          attendanceOutcome: val as any,
                          autoComplete: val === "attended",
                        })
                      }
                    >
                      <SelectTrigger className="text-xs h-7 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_recorded" className="text-xs">Not recorded</SelectItem>
                        <SelectItem value="attended" className="text-xs">Attended</SelectItem>
                        <SelectItem value="missed" className="text-xs">Missed</SelectItem>
                        <SelectItem value="excused" className="text-xs">Excused</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>

                  <td className="p-3">
                    {it.evidenceStatus === "Verified" ? (
                      <Badge className="bg-emerald-600 text-white text-[10px] flex items-center gap-1 w-fit">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified
                      </Badge>
                    ) : it.evidenceStatus === "Submitted" ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={reviewEvidenceMutation.isPending}
                          onClick={() =>
                            reviewEvidenceMutation.mutate({
                              assignmentId: it.assignmentId,
                              decision: "verified",
                              autoComplete: true,
                            })
                          }
                        >
                          <Check className="h-3 w-3 mr-0.5" />
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] text-rose-600 border-rose-300"
                          disabled={reviewEvidenceMutation.isPending}
                          onClick={() => {
                            const reason = prompt("Enter reason for evidence rejection:");
                            if (reason && reason.trim()) {
                              reviewEvidenceMutation.mutate({
                                assignmentId: it.assignmentId,
                                decision: "rejected",
                                note: reason.trim(),
                              });
                            }
                          }}
                        >
                          <X className="h-3 w-3 mr-0.5" />
                          Reject
                        </Button>
                      </div>
                    ) : it.evidenceStatus === "Rejected" ? (
                      <Badge variant="outline" className="text-rose-600 border-rose-300 text-[10px]">
                        Rejected
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">None</span>
                    )}
                  </td>

                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        title="Send in-app message to nurse"
                        onClick={() => navigate(`/messages?nurseId=${it.nurseId}`)}
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-sky-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        title="Open nurse profile"
                        onClick={() => navigate(`/nurses/${it.nurseId}`)}
                      >
                        Profile
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
