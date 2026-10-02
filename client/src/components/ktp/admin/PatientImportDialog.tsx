import { useRef, useState } from "react";
import { Download, FileUp } from "lucide-react";
import { ClayButton } from "@/components/clay";
import { trpc } from "@/lib/trpc";
import type { ImportRow } from "../../../../../server/dbPatientImport";
import { useAdminToast } from "./AdminToaster";
import { ClayDialog } from "./ClayDialog";
import { PatientImportRow, type ImportEntry } from "./PatientImportRow";

/*
 * Import of new patients from a file, on the Patients page. Step 1: the user chooses an Excel,
 * CSV, PDF, or photo file. The Python reader (POST /api/patient_import) returns the patients that
 * it found. Step 2: the user reviews each patient, corrects values, and saves. The server checks
 * each patient with the rules of the Enroll patient form and saves all patients, or none.
 */

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const TEMPLATE_COLUMNS = [
  "HRN", "Last Name", "First Name", "Middle Name", "Suffix", "Type", "Sex", "Birth Date", "Gmail", "Contact Number",
  "Stage", "Transplant Date", "Risk", "Follow-up", "Status", "Nephrologist", "Fellow", "Recipient HRN",
];
const FIELDS: (keyof ImportRow)[] = [
  "hrn", "patientType", "firstName", "middleName", "lastName", "suffix", "sex", "birthDate", "contactNumber",
  "accountEmail", "stage", "riskCategory", "surgeryDate", "followupMonths", "status", "nephrologist", "fellow",
  "linkedRecipientHrn",
];
type ReaderRow = Record<string, unknown> & { row?: number; warnings?: string[] };
type ReaderResult = { success: boolean; rows: ReaderRow[]; unmappedColumns?: string[]; message?: string; error?: string };

const toBase64 = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split("base64,").pop() ?? "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });

/** Text of a photo, read in the browser. The photo does not leave the device. */
async function photoText(file: File): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { workerPath: "/ocr/worker.min.js", corePath: "/ocr", langPath: "/ocr" });
  try {
    // Wide gaps between words stay in the text, so the reader can find the columns of a table.
    await worker.setParameters({ preserve_interword_spaces: "1" });
    return (await worker.recognize(file)).data.text;
  } finally {
    await worker.terminate();
  }
}

/** Button of the Patients page that opens the import dialog. Must render inside AdminToaster. */
export function PatientImportButton() {
  const [open, setOpen] = useState(false);
  const toast = useAdminToast();
  const utils = trpc.useUtils();
  return (
    <>
      <ClayButton variant="secondary" icon={<FileUp strokeWidth={1.75} />} onClick={() => setOpen(true)}>
        Import patients
      </ClayButton>
      <PatientImportDialog
        open={open}
        onClose={() => setOpen(false)}
        onImported={count => {
          toast({
            title: count === 1 ? "1 patient imported" : `${count} patients imported`,
            body: "The new patients are in the list.",
            tone: "info",
          });
          void Promise.all([utils.patients.list.invalidate(), utils.dashboard.initial.invalidate()]);
        }}
      />
    </>
  );
}

export function PatientImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  return (
    <ClayDialog
      open={open}
      onOpenChange={next => {
        if (!next) onClose();
      }}
      title="Import patients"
      description="Upload a patient list. Review each patient before the save."
      className="sm:max-w-[760px]"
    >
      {open && <ImportBody onClose={onClose} onImported={onImported} />}
    </ClayDialog>
  );
}

function ImportBody({ onClose, onImported }: { onClose: () => void; onImported: (count: number) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<ImportEntry[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const doctors = trpc.doctors.list.useQuery();
  const check = trpc.patientImport.check.useMutation();
  const commit = trpc.patientImport.commit.useMutation();

  const included = (entries ?? []).filter(entry => entry.include);
  const unchecked = included.some(entry => !entry.checked);
  const problems = included.filter(entry => (entry.checked?.errors.length ?? 0) > 0).length;
  const ready = included.length > 0 && !unchecked && problems === 0;

  /** Checks the included patients on the server and stores the result on each one. */
  const runCheck = async (list: ImportEntry[]) => {
    const rows = list.filter(entry => entry.include);
    if (rows.length === 0) return list;
    const results = await check.mutateAsync({ rows: rows.map(entry => entry.values) });
    let index = 0;
    return list.map(entry => (entry.include ? { ...entry, checked: results[index++] } : entry));
  };

  const readFile = async (file: File) => {
    setError("");
    setNote("");
    const photo = file.type.startsWith("image/");
    if (file.size > (photo ? MAX_PHOTO_BYTES : MAX_UPLOAD_BYTES)) {
      setError(`File too large. The maximum size is ${photo ? "15" : "3"} MB.`);
      return;
    }
    try {
      let upload: Blob = file;
      let name = file.name;
      if (photo) {
        setBusy("Reading the text of the photo");
        upload = new Blob([await photoText(file)], { type: "text/plain" });
        name = `${file.name}.txt`;
      }
      setBusy("Reading the patient list");
      const response = await fetch("/api/patient_import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: name, base64: await toBase64(upload) }),
      });
      const result = (await response.json()) as ReaderResult;
      if (!result.success || result.error) {
        setError(result.error || "Could not read the file.");
        return;
      }
      if (result.rows.length === 0) {
        setError(result.message || "No patient was found in the file.");
        return;
      }
      setBusy("Checking each patient");
      const list = result.rows.map<ImportEntry>(row => ({
        source: Number(row.row ?? 0),
        include: true,
        notes: row.warnings ?? [],
        values: Object.fromEntries(FIELDS.map(field => [field, String(row[field] ?? "")])) as ImportRow,
      }));
      setFileName(file.name);
      setNote(
        [
          result.message,
          photo ? "The text came from a photo. Check each value." : "",
          result.unmappedColumns?.length ? `Columns not used: ${result.unmappedColumns.join(", ")}.` : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
      setEntries(await runCheck(list));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read the file.");
    } finally {
      setBusy("");
    }
  };

  const recheck = async () => {
    setError("");
    try {
      setBusy("Checking each patient");
      setEntries(await runCheck(entries ?? []));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not check the list.");
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    setError("");
    try {
      const saved = await commit.mutateAsync({ fileName, rows: included.map(entry => entry.values) });
      onImported(saved.count);
      onClose();
    } catch (cause) {
      // The registry can change between the check and the save. A new check shows what changed.
      setError(cause instanceof Error ? cause.message : "Could not save. Try again.");
      setEntries(current => current?.map(entry => ({ ...entry, checked: undefined })) ?? null);
    }
  };

  const template = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`${TEMPLATE_COLUMNS.join(",")}\n`], { type: "text/csv" }));
    link.download = "ktp-patient-list-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="flex min-w-0 flex-col gap-5" aria-busy={Boolean(busy) || commit.isPending}>
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,.csv,.pdf,.txt,image/*"
        hidden
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void readFile(file);
        }}
      />

      {entries === null ? (
        <>
          <div className="space-y-2 type-body-sm">
            <p>
              The file can be an Excel workbook (.xlsx), a CSV file, a PDF with a table, or a photo of a list. The
              first row of the table must have the column names.
            </p>
            <p className="text-ink-muted">
              Columns that the reader knows: {TEMPLATE_COLUMNS.join(", ")}. A column named Patient Name with
              &quot;Last, First&quot; also works.
            </p>
            <p className="text-ink-muted">
              Each patient needs an HRN, a name, and a type (Recipient or Donor). A donor needs the HRN of the
              linked recipient. A Gmail account is optional: without it, the patient cannot sign in to the patient
              portal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ClayButton
              icon={<FileUp strokeWidth={1.75} />}
              loading={Boolean(busy)}
              onClick={() => fileInput.current?.click()}
            >
              {busy || "Choose a file"}
            </ClayButton>
            <ClayButton variant="ghost" icon={<Download strokeWidth={1.75} />} onClick={template}>
              Download the template
            </ClayButton>
          </div>
          <p className="type-caption text-ink-muted">
            Maximum 3 MB for a file and 15 MB for a photo. A photo is read on this device and is not uploaded.
          </p>
        </>
      ) : (
        <>
          <p role="status" className="rounded-sm bg-info-bg px-3 py-2 type-body-sm text-info">
            <span className="font-bold break-all">{fileName}</span>: {note}
          </p>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {entries.map((entry, index) => (
              <PatientImportRow
                key={entry.source + ":" + index}
                entry={entry}
                doctors={doctors.data ?? []}
                onChange={next =>
                  setEntries(
                    current =>
                      current?.map((item, at) =>
                        at === index
                          ? next
                          : // The set of patients changed, so the duplicate checks of the other patients are old.
                            next.include !== entry.include
                            ? { ...item, checked: undefined }
                            : item
                      ) ?? null
                  )
                }
              />
            ))}
          </ul>
          <p role="status" className="type-body-sm">
            {included.length === 0
              ? "No patient is selected."
              : unchecked
                ? "A value changed. Check the list again."
                : problems > 0
                  ? `${problems} of ${included.length} selected ${included.length === 1 ? "patient has" : "patients have"} a problem. Correct the values, or clear the check box of that patient.`
                  : `${included.length} ${included.length === 1 ? "patient is" : "patients are"} ready.`}
          </p>
        </>
      )}

      {error && (
        <p role="alert" className="type-body-sm text-overdue break-words">
          {error}
        </p>
      )}

      {entries !== null && (
        <div className="flex flex-wrap-reverse items-center justify-end gap-3">
          <ClayButton
            variant="ghost"
            disabled={Boolean(busy) || commit.isPending}
            onClick={() => {
              setEntries(null);
              setError("");
            }}
          >
            Choose another file
          </ClayButton>
          <ClayButton variant="secondary" onClick={onClose} disabled={commit.isPending}>
            Cancel
          </ClayButton>
          {ready ? (
            <ClayButton loading={commit.isPending} onClick={save}>
              {included.length === 1 ? "Import 1 patient" : `Import ${included.length} patients`}
            </ClayButton>
          ) : (
            <ClayButton loading={Boolean(busy)} disabled={included.length === 0} onClick={recheck}>
              Check again
            </ClayButton>
          )}
        </div>
      )}
    </div>
  );
}
