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

  let activeWorker: any = null;
  let timer: any = null;
  let isCancelled = false;
  let isCleanedUp = false;
  let abortHandler: (() => void) | null = null;

  const terminateSafe = async (w: any) => {
    if (!w) return;
    try {
      await w.terminate();
    } catch (err) {
      console.warn("Failed to terminate OCR worker:", err);
    }
  };

  const cleanup = async () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    isCancelled = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (signal && abortHandler) {
      signal.removeEventListener("abort", abortHandler);
      abortHandler = null;
    }
    if (activeWorker) {
      const w = activeWorker;
      activeWorker = null;
      await terminateSafe(w);
    }
  };

  try {
    if (signal?.aborted) {
      throw new Error("OCR cancelled before starting");
    }

    const abortPromise = new Promise<never>((_, reject) => {
      if (signal) {
        abortHandler = () => {
          isCancelled = true;
          reject(new Error("OCR cancelled by user"));
        };
        signal.addEventListener("abort", abortHandler, { once: true });
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        isCancelled = true;
        reject(new Error("OCR operation timed out after 60 seconds"));
      }, timeoutMs);
    });

    const ocrTask = (async () => {
      if (!isCancelled && !signal?.aborted) {
        options?.onProgress?.({ status: "Loading OCR engine…", progress: 0.1 });
      }
      const { createWorker } = await import("tesseract.js");

      if (isCancelled || signal?.aborted) throw new Error("Cancelled");

      const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
      const workerPath = `${origin}/ocr/worker.min.js`;
      const corePath = `${origin}/ocr`;
      const langPath = `${origin}/ocr`;

      const instance = await createWorker("eng", 1, {
        workerPath,
        corePath,
        langPath,
        logger: (m: any) => {
          if (isCancelled || isCleanedUp || signal?.aborted) return;
          if (m?.status && typeof m?.progress === "number") {
            options?.onProgress?.({
              status: m.status,
              progress: m.progress,
            });
          }
        },
      });

      if (isCancelled || isCleanedUp || signal?.aborted) {
        await terminateSafe(instance);
        throw new Error("Cancelled");
      }

      activeWorker = instance;

      if (!isCancelled && !signal?.aborted) {
        options?.onProgress?.({ status: "Recognizing image text…", progress: 0.5 });
      }

      const res = await instance.recognize(imageSource);

      if (isCancelled || isCleanedUp || signal?.aborted) {
        throw new Error("Cancelled");
      }

      const text = res?.data?.text || "";
      const extracted = extractPrcFields(text);
      return { text, extracted };
    })();

    const result = await Promise.race([ocrTask, abortPromise, timeoutPromise]);
    return result;
  } finally {
    await cleanup();
  }
}
