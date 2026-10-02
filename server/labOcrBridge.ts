import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface ParsedLabTest {
  labTestId: number;
  testName: string;
  value: string;
  unit: string;
  rawText: string;
  confidence: number;
}

export interface ParseLabReportResult {
  success: boolean;
  detectedDate: string | null;
  tests: ParsedLabTest[];
  lineCount?: number;
  extractedCount: number;
  message?: string;
  error?: string;
}

const PARSER_SCRIPT = path.resolve(process.cwd(), "scripts", "parse_lab_ocr.py");

/**
 * Execute Python lab OCR parser on an existing file path.
 */
export async function parseLabFile(filePath: string): Promise<ParseLabReportResult> {
  try {
    const pythonExe = process.platform === "win32" ? "python" : "python3";
    const { stdout, stderr } = await execFileAsync(pythonExe, [PARSER_SCRIPT, filePath], {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stderr && stderr.includes("Traceback")) {
      console.error("[Lab OCR Python Error]", stderr);
    }

    const parsed = JSON.parse(stdout) as ParseLabReportResult;
    return parsed;
  } catch (err: any) {
    console.error("[Lab OCR Execution Failed]", err);
    return {
      success: false,
      detectedDate: null,
      tests: [],
      extractedCount: 0,
      error: err.message || "Failed to execute Python OCR engine",
    };
  }
}

/**
 * Parse a raw buffer (PDF or Image) by staging to a temporary file.
 */
export async function parseLabBuffer(buffer: Buffer, fileName: string): Promise<ParseLabReportResult> {
  const ext = path.extname(fileName) || ".pdf";
  const tempPath = path.join(os.tmpdir(), `ktp-ocr-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);

  try {
    await fs.promises.writeFile(tempPath, buffer);
    return await parseLabFile(tempPath);
  } finally {
    try {
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath);
      }
    } catch {
      // Ignore cleanup error
    }
  }
}
