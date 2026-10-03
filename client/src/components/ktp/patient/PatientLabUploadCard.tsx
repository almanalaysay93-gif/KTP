import { useState, useRef } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Image as ImageIcon,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ClayButton, ClayCard } from "@/components/clay";
import { UploadProgress, type UploadPhase } from "@/components/motion/UploadProgress";
import { LAB_NORMAL_VALUES } from "@/components/ktp/admin/labCatalogMeta";
import { trpc } from "@/lib/trpc";

interface ExtractedItem {
  id: string;
  labTestId: number;
  testName: string;
  value: string;
  unit: string;
  normalRange?: string;
}

interface PatientLabUploadCardProps {
  onSuccess?: () => void;
}

export function PatientLabUploadCard({ onSuccess }: PatientLabUploadCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [serviceDate, setServiceDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState<string>("");
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseMutation = trpc.patientPortal.parseLabDocument.useMutation({
    onSuccess: (data) => {
      setProgressPercent(100);
      setUploadPhase("complete");

      if (data.detectedDate) {
        setServiceDate(data.detectedDate);
      }

      if (data.tests && data.tests.length > 0) {
        const mapped: ExtractedItem[] = data.tests.map((t, idx) => ({
          id: `item-${idx}-${Date.now()}`,
          labTestId: t.labTestId,
          testName: t.testName,
          value: t.value,
          unit: t.unit || "",
          normalRange: LAB_NORMAL_VALUES[t.testName] || "Reference standard",
        }));
        setExtractedItems(mapped);
      } else {
        setErrorMessage(
          "Could not detect clear lab values from this document. Please enter values manually."
        );
      }
    },
    onError: (err) => {
      setUploadPhase("error");
      setErrorMessage(err.message || "Failed to process document");
    },
  });

  const submitMutation = trpc.patientPortal.submitPatientLab.useMutation({
    onSuccess: () => {
      setSubmitSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        handleReset();
        setIsOpen(false);
      }, 3000);
    },
    onError: (err) => {
      setErrorMessage(err.message || "Submission failed");
    },
  });

  const handleReset = () => {
    setFile(null);
    setUploadPhase("idle");
    setProgressPercent(0);
    setErrorMessage("");
    setExtractedItems([]);
    setSubmitSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setErrorMessage("");
    setUploadPhase("uploading");
    setProgressPercent(35);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setProgressPercent(70);
      setUploadPhase("transcribing");

      parseMutation.mutate({
        fileName: selectedFile.name,
        base64,
      });
    };
    reader.onerror = () => {
      setUploadPhase("error");
      setErrorMessage("Failed to read the selected file.");
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleValueChange = (id: string, newVal: string) => {
    setExtractedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, value: newVal } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    setExtractedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = () => {
    if (extractedItems.length === 0) {
      setErrorMessage("No lab results to submit.");
      return;
    }

    submitMutation.mutate({
      serviceDate,
      note: notes.trim() || undefined,
      items: extractedItems.map((item) => ({
        labTestId: item.labTestId,
        value: item.value.trim(),
      })),
    });
  };

  if (!isOpen) {
    return (
      <div className="flex justify-end">
        <ClayButton
          variant="primary"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 text-xs"
        >
          <Upload className="w-4 h-4" />
          Upload Lab Report or PDF
        </ClayButton>
      </div>
    );
  }

  return (
    <ClayCard className="p-4 md:p-6 bg-[#fbfbf7] border border-[#c8ccb5] shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#dce1ce] pb-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-[#4f5b3a]" />
          <div>
            <h2 className="text-sm md:text-base font-bold text-[#2c3320]">
              Patient Document & Lab Upload
            </h2>
            <p className="text-xs text-[#606950]">
              Upload PDF laboratory reports, Excel sheets, or phone photos for automatic parsing.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            handleReset();
            setIsOpen(false);
          }}
          className="p-1 rounded-md text-[#606950] hover:bg-[#eef1e6] hover:text-[#2c3320]"
          title="Close upload card"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Submission Success Banner */}
      {submitSuccess && (
        <div className="p-4 rounded-lg bg-[#4f5b3a]/15 border border-[#8b9474]/50 text-[#333e22] flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#4f5b3a] shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-sm">Lab Results Successfully Submitted</p>
            <p>
              Your report is registered in your chart under status Pending Nurse Verification. The
              transplant clinical team will review and approve your values.
            </p>
          </div>
        </div>
      )}

      {/* Dropzone Area */}
      {!submitSuccess && extractedItems.length === 0 && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-[#c8ccb5] hover:border-[#4f5b3a] rounded-xl p-6 text-center bg-[#f3f5eb]/60 transition-colors cursor-pointer space-y-3"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
          />

          <div className="mx-auto w-12 h-12 rounded-full bg-[#e2e7d5] flex items-center justify-center text-[#4f5b3a]">
            <Upload className="w-6 h-6" />
          </div>

          <div>
            <p className="text-xs md:text-sm font-semibold text-[#2c3320]">
              Click to choose file or drag and drop here
            </p>
            <p className="text-[11px] text-[#606950] mt-1">
              Supports Hospital PDF reports, Excel files (.xlsx, .csv), and camera images (.png, .jpg)
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 text-[11px] text-[#606950] pt-2">
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-[#4f5b3a]" /> PDF Documents
            </span>
            <span className="flex items-center gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#3b5971]" /> Excel & CSV
            </span>
            <span className="flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-[#b47d1e]" /> Camera Scans
            </span>
          </div>
        </div>
      )}

      {/* Progress & Processing Indicator */}
      {uploadPhase !== "idle" && !submitSuccess && extractedItems.length === 0 && (
        <div className="p-4 rounded-lg bg-[#e8ebde]/70 border border-[#c8ccb5]">
          <UploadProgress
            progress={progressPercent}
            phase={uploadPhase}
            fileName={file?.name}
            errorText={errorMessage}
          />
        </div>
      )}

      {/* Extracted Values Review Form */}
      {extractedItems.length > 0 && !submitSuccess && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#e8ebde]/60 p-3 rounded-lg border border-[#c8ccb5] text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-[#4b543b] mb-1">
                Lab Test Collection Date
              </label>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="clay-sunken clay-focus h-8 w-full rounded-md border border-[#c8ccb5] bg-[#fbfbf7] px-2.5 text-xs text-[#2c3320]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#4b543b] mb-1">
                Clinical Note or Laboratory Facility (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. SPMC Central Clinical Laboratory"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="clay-sunken clay-focus h-8 w-full rounded-md border border-[#c8ccb5] bg-[#fbfbf7] px-2.5 text-xs text-[#2c3320]"
              />
            </div>
          </div>

          {/* Four narrow columns so the table fits a 360 px phone: the unit sits under its value. */}
          <div className="show-scrollbar-x overflow-x-auto border border-[#c8ccb5] rounded-lg bg-[#fbfbf7]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#e4e8d8] text-[#3e472f] border-b border-[#c8ccb5] uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-2">Test</th>
                  <th className="py-2.5 px-2 w-24">Value</th>
                  <th className="py-2.5 px-2">Usual range</th>
                  <th className="py-2.5 px-2"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dce1ce]">
                {extractedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#f2f4ec] transition-colors">
                    <td className="py-2.5 px-2 font-medium text-[#2c3320]">{item.testName}</td>
                    <td className="py-2.5 px-2">
                      <input
                        type="text"
                        aria-label={`${item.testName}${item.unit ? `, ${item.unit}` : ""}`}
                        value={item.value}
                        onChange={(e) => handleValueChange(item.id, e.target.value)}
                        className="clay-sunken clay-focus h-8 w-full rounded-md border border-[#c8ccb5] bg-[#fbfbf7] px-2.5 text-xs font-mono font-bold text-[#2c3320]"
                      />
                      {item.unit ? <span className="mt-1 block font-mono text-ink-muted">{item.unit}</span> : null}
                    </td>
                    <td className="py-2.5 px-2 text-[11px] text-[#606950]">
                      {item.normalRange}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 rounded text-[#ae3c30] hover:bg-[#ae3c30]/10"
                        title="Remove row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-[#ae3c30]/15 border border-[#ae3c30]/30 text-[#82241b] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <ClayButton variant="ghost" size="sm" onClick={handleReset}>
              Discard and Choose Another File
            </ClayButton>

            <ClayButton
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={submitMutation.isPending || extractedItems.length === 0}
            >
              {submitMutation.isPending
                ? "Submitting..."
                : `Submit ${extractedItems.length} Tests for Verification`}
            </ClayButton>
          </div>
        </div>
      )}
    </ClayCard>
  );
}
