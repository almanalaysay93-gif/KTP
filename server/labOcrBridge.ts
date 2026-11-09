import { execFile } from "node:child_process";
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

/**
 * Execute Python lab OCR parser on an existing file path.
 */
export async function parseLabFile(
  filePath: string
): Promise<ParseLabReportResult> {
  try {
    const root = process.env.KTP_APP_ROOT || process.cwd();
    const script = path.resolve(root, "scripts", "parse_lab_ocr.py");
    const pythonExe =
      process.env.KTP_PYTHON ||
      (process.platform === "win32" ? "python" : "python3");
    if (process.env.KTP_PYTHON && !path.isAbsolute(pythonExe))
      throw new Error("Invalid Python runtime");
    const { stdout } = await execFileAsync(pythonExe, [script, filePath], {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      cwd: root,
    });

    const parsed = JSON.parse(stdout) as ParseLabReportResult;
    return parsed;
  } catch {
    return {
      success: false,
      detectedDate: null,
      tests: [],
      extractedCount: 0,
      error: "Could not read the laboratory report.",
    };
  }
}

/**
 * Parse a raw buffer (PDF or Image) by staging to a temporary file.
 */
export async function parseLabBuffer(
  buffer: Buffer,
  fileName: string
): Promise<ParseLabReportResult> {
  const ext = path.extname(fileName) || ".pdf";
  const folder = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ktp-ocr-"));
  await fs.promises.chmod(folder, 0o700);
  const tempPath = path.join(folder, `report${ext}`);

  try {
    await fs.promises.writeFile(tempPath, buffer, { mode: 0o600 });
    return await parseLabFile(tempPath);
  } finally {
    try {
      await fs.promises.rm(folder, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
}
