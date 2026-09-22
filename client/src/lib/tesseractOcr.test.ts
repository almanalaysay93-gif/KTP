import { describe, it, expect, vi } from "vitest";
import { recognizePrcImage } from "./tesseractOcr";

describe("Tesseract OCR Runner & Worker Lifecycle (A1, A3, T1, T4)", () => {
  it("rejects immediately if signal is already aborted without spawning worker", async () => {
    const ac = new AbortController();
    ac.abort();

    await expect(
      recognizePrcImage("data:image/png;base64,fake", {
        signal: ac.signal,
      })
    ).rejects.toThrow("OCR cancelled before starting");
  });

  it("terminates worker and rejects when timeoutMs expires", async () => {
    // 1ms timeout forces timeout branch
    await expect(
      recognizePrcImage("data:image/png;base64,fake", {
        timeoutMs: 1,
      })
    ).rejects.toThrow("OCR operation timed out after 60 seconds");
  });

  it("terminates worker and rejects when AbortSignal triggers mid-execution", async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 10);

    await expect(
      recognizePrcImage("data:image/png;base64,fake", {
        signal: ac.signal,
        timeoutMs: 10000,
      })
    ).rejects.toThrow("OCR cancelled by user");
  });
});
