import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ALLOWED_PHOTO_MIMES, ALLOWED_DOCUMENT_MIMES, MAX_FILE_BYTES, validateMime } from "../../../../shared/nursetrack";
import { Upload } from "lucide-react";

/**
 * File picker that returns base64 content ready for the upload mutations.
 * Validates MIME type and size before returning.
 */
const SMART_IMPORT_ACCEPT =
  "image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv,.csv,.xlsx,.xls,.docx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Compress image using HTML Canvas to reduce resolution and file size. */
export async function compressImage(
  file: File,
  maxDim: number,
  quality: number,
): Promise<{ fileBase64: string; fileName: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback to reading file directly
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve({
            fileBase64: result.split(",")[1] ?? "",
            fileName: file.name,
            mimeType: file.type || "image/jpeg",
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer WebP with JPEG fallback if WebP encoding is unsupported
      const isWebpSupported = canvas.toDataURL("image/webp").startsWith("data:image/webp");
      const targetMime = isWebpSupported ? "image/webp" : "image/jpeg";
      const targetExt = isWebpSupported ? "webp" : "jpg";

      const dataUrl = canvas.toDataURL(targetMime, quality);
      const base64 = dataUrl.split(",")[1] ?? "";
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      resolve({
        fileBase64: base64,
        fileName: `${baseName}.${targetExt}`,
        mimeType: targetMime,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({
          fileBase64: result.split(",")[1] ?? "",
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };
    img.src = url;
  });
}

export function pickFile(
  kind: "photo" | "document" | "smartImport",
): Promise<{ fileBase64: string; fileName: string; mimeType: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept =
      kind === "photo"
        ? "image/*"
        : kind === "document"
          ? "image/jpeg,image/png,image/webp,application/pdf"
          : SMART_IMPORT_ACCEPT;

    // Mount to DOM so iOS Safari / WebKit doesn't block detached element click()
    input.style.position = "fixed";
    input.style.top = "-9999px";
    input.style.left = "-9999px";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";
    document.body.appendChild(input);

    const cleanup = () => {
      if (input.parentNode) {
        document.body.removeChild(input);
      }
    };

    input.onchange = async () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        resolve(null);
        return;
      }

      const mimeCheck = validateMime(file.type, kind, file.name);
      if (!mimeCheck.ok) {
        toast.error(mimeCheck.error ?? "File type not supported.");
        resolve(null);
        return;
      }

      if (kind === "photo") {
        try {
          const compressed = await compressImage(file, 320, 0.8);
          resolve(compressed);
        } catch {
          toast.error("Could not process the photo.");
          resolve(null);
        }
        return;
      }

      // Document photos (e.g. smartphone snapshots of certificates/licenses): downscale to 1600px WebP
      const isImage = (file.type && file.type.startsWith("image/")) || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name);
      if (isImage) {
        try {
          const compressed = await compressImage(file, 1600, 0.82);
          resolve(compressed);
          return;
        } catch {
          // Fall through to raw reader if canvas compression fails
        }
      }

      if (file.size > MAX_FILE_BYTES) {
        toast.error("File is too large (max 10 MB).");
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] ?? "";
        resolve({ fileBase64: base64, fileName: file.name, mimeType: file.type || "application/octet-stream" });
      };
      reader.onerror = () => {
        toast.error("Could not read the file.");
        resolve(null);
      };
      reader.readAsDataURL(file);
    };

    // Clean up if file dialog is cancelled (window regains focus without change event)
    const onWindowFocus = () => {
      window.removeEventListener("focus", onWindowFocus);
      setTimeout(() => {
        cleanup();
      }, 1000);
    };
    window.addEventListener("focus", onWindowFocus, { once: true });

    input.click();
  });
}

export function pickRawFile(
  accept: string = "image/jpeg,image/png,image/webp,application/pdf"
): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.position = "fixed";
    input.style.top = "-9999px";
    input.style.left = "-9999px";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";
    document.body.appendChild(input);

    const cleanup = () => {
      if (input.parentNode) {
        document.body.removeChild(input);
      }
    };

    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      cleanup();
      resolve(file);
    };

    const onWindowFocus = () => {
      window.removeEventListener("focus", onWindowFocus);
      setTimeout(() => {
        cleanup();
      }, 1000);
    };
    window.addEventListener("focus", onWindowFocus, { once: true });

    input.click();
  });
}

export async function fileToBase64(file: File): Promise<{ fileBase64: string; fileName: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve({ fileBase64: base64, fileName: file.name, mimeType: file.type || "application/octet-stream" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function FileUploadButton({
  kind,
  onFile,
  label,
  disabled,
  className,
}: {
  kind: "photo" | "document" | "smartImport";
  onFile: (file: { fileBase64: string; fileName: string; mimeType: string }) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      className={className}
      onClick={async () => {
        const file = await pickFile(kind);
        if (file) onFile(file);
      }}
    >
      <Upload className="h-4 w-4 mr-1" />
      {label ?? (kind === "photo" ? "Upload Photo" : "Upload File")}
    </Button>
  );
}

