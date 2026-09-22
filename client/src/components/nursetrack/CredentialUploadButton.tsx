import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { pickRawFile, compressImage, fileToBase64 } from "./FileUpload";
import { PrcOcrReviewDialog, type PrcExistingValues } from "./PrcOcrReviewDialog";
import { MAX_FILE_BYTES, validateMime } from "../../../../shared/nursetrack";

export interface CredentialUploadButtonProps {
  credential: {
    id: number;
    typeName?: string;
    licenseNumber?: string | null;
    issueDate?: string | Date | null;
    expiryDate?: string | Date | null;
    nurseName?: string;
  };
  onUpload: (payload: {
    file: { fileBase64: string; fileName: string; mimeType: string };
    confirmedFields?: {
      licenseNumber?: string | null;
      issueDate?: string | null;
      expiryDate?: string | null;
    };
  }) => Promise<void> | void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function CredentialUploadButton({
  credential,
  onUpload,
  label,
  disabled,
  className,
}: CredentialUploadButtonProps) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const isPrc = Boolean(credential.typeName?.toLowerCase().includes("prc"));

  const handleClick = async () => {
    const file = await pickRawFile("image/jpeg,image/png,image/webp,application/pdf");
    if (!file) return;

    const mimeCheck = validateMime(file.type, "document", file.name);
    if (!mimeCheck.ok) {
      toast.error(mimeCheck.error ?? "File type not supported.");
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      toast.error("File is too large (max 10 MB).");
      return;
    }

    const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name);

    // If PRC and Image: Run OCR before document compression via review dialog
    if (isPrc && isImage) {
      setSelectedFile(file);
      setReviewOpen(true);
      return;
    }

    // Default flow (PDF or non-PRC credentials): direct upload without OCR review
    try {
      setIsUploading(true);
      let payloadFile: { fileBase64: string; fileName: string; mimeType: string };
      if (isImage) {
        payloadFile = await compressImage(file, 1600, 0.82);
      } else {
        payloadFile = await fileToBase64(file);
      }
      await onUpload({ file: payloadFile });
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload document.");
    } finally {
      setIsUploading(false);
    }
  };

  const existingValues: PrcExistingValues = {
    credentialId: credential.id,
    licenseNumber: credential.licenseNumber,
    issueDate: credential.issueDate,
    expiryDate: credential.expiryDate,
    nurseName: credential.nurseName,
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isUploading}
        className={className}
        onClick={handleClick}
      >
        <Upload className="h-4 w-4 mr-1" />
        {label ?? "Upload"}
      </Button>

      {isPrc && (
        <PrcOcrReviewDialog
          open={reviewOpen}
          onOpenChange={(v) => {
            setReviewOpen(v);
            if (!v) setSelectedFile(null);
          }}
          file={selectedFile}
          existingValues={existingValues}
          isSaving={isUploading}
          onSaveWithFields={async (payload) => {
            setIsUploading(true);
            try {
              await onUpload({
                file: payload.file,
                confirmedFields: payload.confirmedFields,
              });
            } finally {
              setIsUploading(false);
            }
          }}
          onSaveDocumentOnly={async (payload) => {
            setIsUploading(true);
            try {
              await onUpload({
                file: payload.file,
              });
            } finally {
              setIsUploading(false);
            }
          }}
          onCancel={() => {
            setSelectedFile(null);
          }}
        />
      )}
    </>
  );
}
