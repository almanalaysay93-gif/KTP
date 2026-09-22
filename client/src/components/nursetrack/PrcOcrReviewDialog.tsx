import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { recognizePrcImage } from "@/lib/tesseractOcr";
import { compressImage } from "./FileUpload";
import { formatDate } from "../../../../shared/nursetrack";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, ChevronDown, FileText, Loader2, RefreshCw, Upload } from "lucide-react";

export interface PrcExistingValues {
  credentialId: number;
  licenseNumber?: string | null;
  issueDate?: string | Date | null;
  expiryDate?: string | Date | null;
  nurseName?: string;
}

export interface PrcOcrReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  existingValues: PrcExistingValues;
  onSaveWithFields: (payload: {
    file: { fileBase64: string; fileName: string; mimeType: string };
    confirmedFields: {
      licenseNumber?: string | null;
      issueDate?: string | null;
      expiryDate?: string | null;
    };
  }) => Promise<void> | void;
  onSaveDocumentOnly: (payload: {
    file: { fileBase64: string; fileName: string; mimeType: string };
  }) => Promise<void> | void;
  onCancel?: () => void;
  isSaving?: boolean;
}

export function PrcOcrReviewDialog({
  open,
  onOpenChange,
  file,
  existingValues,
  onSaveWithFields,
  onSaveDocumentOnly,
  onCancel,
  isSaving = false,
}: PrcOcrReviewDialogProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"analyzing" | "review" | "error">("analyzing");
  const [progressText, setProgressText] = useState<string>("Initializing OCR worker…");
  const [progressVal, setProgressVal] = useState<number>(10);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Extracted and editable fields
  const [licenseNumber, setLicenseNumber] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [rawOcrText, setRawOcrText] = useState<string>("");
  const [showRawText, setShowRawText] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Setup preview and run OCR when file changes / dialog opens
  useEffect(() => {
    if (!open || !file) {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);

    runOcr(file);

    return () => {
      URL.revokeObjectURL(objectUrl);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [open, file]);

  const runOcr = async (targetFile: File) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setOcrStatus("analyzing");
    setProgressVal(15);
    setProgressText("Initializing OCR worker…");
    setErrorMessage("");

    try {
      const res = await recognizePrcImage(targetFile, {
        signal: ac.signal,
        timeoutMs: 60000,
        onProgress: (p) => {
          const pct = Math.min(Math.round(p.progress * 100), 100);
          setProgressVal(Math.max(pct, 15));
          if (p.status === "loading tesseract core") {
            setProgressText("Loading OCR core engine…");
          } else if (p.status === "loading language traineddata") {
            setProgressText("Loading language model…");
          } else if (p.status === "recognizing text") {
            setProgressText(`Scanning PRC card (${pct}%)…`);
          } else {
            setProgressText(p.status || "Reading text…");
          }
        },
      });

      if (ac.signal.aborted) return;

      setRawOcrText(res.text);
      setLicenseNumber(res.extracted.licenseNumber ?? "");
      setIssueDate(res.extracted.issueDate ?? "");
      setExpiryDate(res.extracted.expiryDate ?? "");
      setOcrStatus("review");
    } catch (err: any) {
      if (ac.signal.aborted) return;
      console.warn("OCR process error:", err);
      setErrorMessage(err?.message || "Failed to extract text from this image.");
      setOcrStatus("error");
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    onCancel?.();
    onOpenChange(false);
  };

  const handleSaveWithReviewedFields = async () => {
    if (!file) return;

    // Validate issue date <= expiry date if both are provided
    if (issueDate && expiryDate) {
      const d1 = new Date(issueDate);
      const d2 = new Date(expiryDate);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d1 > d2) {
        toast.error("Issue date cannot be after expiry date.");
        return;
      }
    }

    try {
      const compressed = await compressImage(file, 1600, 0.82);
      await onSaveWithFields({
        file: compressed,
        confirmedFields: {
          licenseNumber: licenseNumber.trim() || null,
          issueDate: issueDate || null,
          expiryDate: expiryDate || null,
        },
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save document and fields.");
    }
  };

  const handleSaveDocumentOnly = async () => {
    if (!file) return;
    try {
      const compressed = await compressImage(file, 1600, 0.82);
      await onSaveDocumentOnly({ file: compressed });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save document.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleCancel()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Review PRC License Document
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            {ocrStatus === "analyzing"
              ? "Running browser OCR to read license details. Values will appear for review."
              : ocrStatus === "error"
                ? "OCR could not read fields from this image. You can retry or proceed with document-only upload."
                : "Verify the extracted PRC license fields against the uploaded card image before saving."}
          </DialogDescription>
        </DialogHeader>

        {/* Status: Analyzing */}
        {ocrStatus === "analyzing" && (
          <div className="space-y-5 py-4">
            {imageUrl && (
              <div className="relative rounded-lg border overflow-hidden max-h-52 flex items-center justify-center bg-muted/20">
                <img src={imageUrl} alt="PRC Document" className="max-h-52 object-contain" />
              </div>
            )}
            <div className="space-y-2 text-center max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{progressText}</span>
              </div>
              <Progress value={progressVal} className="h-2 w-full" />
              <p className="text-xs text-muted-foreground">
                Processing in your browser. This worker will automatically terminate after completion or timeout.
              </p>
            </div>
            <div className="flex justify-center pt-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Status: Error / OCR Failure */}
        {ocrStatus === "error" && (
          <div className="space-y-4 py-3">
            {imageUrl && (
              <div className="rounded-lg border overflow-hidden max-h-48 flex items-center justify-center bg-muted/20">
                <img src={imageUrl} alt="PRC Document" className="max-h-48 object-contain" />
              </div>
            )}
            <div className="p-3.5 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm space-y-1">
                <p className="font-semibold text-destructive">OCR processing did not complete</p>
                <p className="text-muted-foreground">
                  {errorMessage || "Unable to extract text automatically from the selected document."}
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => file && runOcr(file)}
                disabled={isSaving}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry OCR
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveDocumentOnly}
                disabled={isSaving}
                className="flex items-center gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                {isSaving ? "Saving…" : "Save document only"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Status: Review */}
        {ocrStatus === "review" && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {/* Left column: Card Image Preview */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Uploaded Document Preview
                </Label>
                {imageUrl && (
                  <div className="rounded-lg border overflow-hidden bg-muted/10 max-h-64 sm:max-h-72 flex items-center justify-center">
                    <img src={imageUrl} alt="PRC Card" className="max-h-64 sm:max-h-72 w-full object-contain" />
                  </div>
                )}
                <div className="p-2.5 rounded border bg-card/60 text-xs space-y-1">
                  <div className="font-medium text-foreground">Current values on file:</div>
                  <div className="text-muted-foreground">
                    PRC Number: <span className="font-mono text-foreground font-semibold">{existingValues.licenseNumber || "None"}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Issue Date: <span className="text-foreground">{formatDate(existingValues.issueDate) || "None"}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Expiry Date: <span className="text-foreground">{formatDate(existingValues.expiryDate) || "None"}</span>
                  </div>
                </div>
              </div>

              {/* Right column: Extracted & Editable Fields */}
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <Label htmlFor="prc-number" className="text-xs font-semibold">
                    PRC License Number
                  </Label>
                  <Input
                    id="prc-number"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="e.g. 0123456"
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Preserves leading zeros. Leave blank if unverified or missing.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="issue-date" className="text-xs font-semibold">
                    Issue Date (Registration Date)
                  </Label>
                  <Input
                    id="issue-date"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="expiry-date" className="text-xs font-semibold">
                    Expiry Date (Valid Until)
                  </Label>
                  <Input
                    id="expiry-date"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Must match card. Never inferred from registration date.
                  </p>
                </div>

                {/* Extracted raw OCR text accordion */}
                <div className="border rounded-md p-2 bg-muted/20 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setShowRawText(!showRawText)}
                    className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <span>View raw OCR extracted text</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showRawText ? "rotate-180" : ""}`} />
                  </button>
                  {showRawText && (
                    <pre className="mt-1 p-2 bg-background border rounded font-mono text-[10px] sm:text-[11px] text-muted-foreground max-h-28 overflow-y-auto whitespace-pre-wrap">
                      {rawOcrText || "(No text recognized)"}
                    </pre>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDocumentOnly}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                {isSaving ? "Saving…" : "Save document only"}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveWithReviewedFields}
                disabled={isSaving}
                className="w-full sm:w-auto flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span>Save document and reviewed fields</span>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
