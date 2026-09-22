import { extractPrcFields, type ExtractedPrcFields } from "./prcExtraction";

export interface OcrProgress {
  status: string;
  progress: number;
}

export interface OcrResult {
  text: string;
  extracted: ExtractedPrcFields;
}

/**
 * Run client-side Tesseract.js OCR on a PRC image.
 *
 * Rules:
 * - Load assets only when called (dynamic import).
 * - Terminate worker after completion, cancellation, or 60s timeout.
 * - Allow abort via AbortSignal.
 */
export async function recognizePrcImage(
  imageSource: string | File | Blob,
  options?: {
    onProgress?: (p: OcrProgress) => void;
    signal?: AbortSignal;
    timeoutMs?: number;
  }
): Promise<OcrResult> {
  const timeoutMs = options?.timeoutMs ?? 60000;
  const signal = options?.signal;

  let worker: any = null;
  let timer: any = null;
  let didTimeout = false;

  try {
    if (signal?.aborted) {
      throw new Error("OCR cancelled before starting");
    }

    const abortPromise = new Promise<never>((_, reject) => {
      if (signal) {
        signal.addEventListener(
          "abort",
          () => {
            reject(new Error("OCR cancelled by user"));
          },
          { once: true }
        );
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        didTimeout = true;
        reject(new Error("OCR operation timed out after 60 seconds"));
      }, timeoutMs);
    });

    const ocrTask = (async () => {
      options?.onProgress?.({ status: "Loading OCR engine…", progress: 0.1 });
      const { createWorker } = await import("tesseract.js");

      if (signal?.aborted || didTimeout) throw new Error("Cancelled");

      const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
      const workerPath = `${origin}/ocr/worker.min.js`;
      const corePath = `${origin}/ocr`;
      const langPath = `${origin}/ocr`;

      worker = await createWorker("eng", 1, {
        workerPath,
        corePath,
        langPath,
        logger: (m: any) => {
          if (m?.status && typeof m?.progress === "number") {
            options?.onProgress?.({
              status: m.status,
              progress: m.progress,
            });
          }
        },
      });

      if (signal?.aborted || didTimeout) throw new Error("Cancelled");

      options?.onProgress?.({ status: "Recognizing image text…", progress: 0.5 });
      const res = await worker.recognize(imageSource);
      const text = res?.data?.text || "";
      const extracted = extractPrcFields(text);
      return { text, extracted };
    })();

    const result = await Promise.race([ocrTask, abortPromise, timeoutPromise]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
    if (worker) {
      try {
        await worker.terminate();
      } catch (err) {
        console.warn("Failed to terminate OCR worker:", err);
      }
    }
  }
}
