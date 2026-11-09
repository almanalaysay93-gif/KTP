import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const mocks = vi.hoisted(() => ({ exec: vi.fn(), spawn: vi.fn() }));
vi.mock("node:child_process", () => ({
  execFile: Object.assign(vi.fn(), {
    [Symbol.for("nodejs.util.promisify.custom")]: mocks.exec,
  }),
  spawn: mocks.spawn,
}));
vi.mock("./_core/sdk", () => ({ sdk: {} }));
vi.mock("./adminAccess", () => ({ hasFullAccess: vi.fn() }));
import { parseLabBuffer, parseLabFile } from "./labOcrBridge";
import { readPatientFile } from "./patientImportRoute";

function reader() {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
  mocks.spawn.mockReturnValue(child);
  return child;
}

const root = path.resolve("/private/installed KTP/app");
const python = path.resolve("/private/installed KTP/python/python.exe");
beforeEach(() => {
  vi.stubEnv("KTP_APP_ROOT", root);
  vi.stubEnv("KTP_PYTHON", python);
  mocks.exec.mockReset();
  mocks.spawn.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("installed Python parser bridges", () => {
  it("runs lab OCR with the bundled interpreter and absolute resource paths", async () => {
    const parsed = {
      success: true,
      tests: [],
      detectedDate: null,
      extractedCount: 0,
    };
    mocks.exec.mockResolvedValue({
      stdout: JSON.stringify(parsed),
      stderr: "private parser diagnostics",
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await parseLabFile("/private/report.pdf")).toEqual(parsed);
    expect(mocks.exec).toHaveBeenCalledWith(
      python,
      [path.join(root, "scripts", "parse_lab_ocr.py"), "/private/report.pdf"],
      {
        cwd: root,
        windowsHide: true,
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    expect(log).not.toHaveBeenCalled();
  });

  it("stages uploaded labs privately outside installation resources and removes them", async () => {
    let staged = "";
    mocks.exec.mockImplementation(async (_python, args: string[]) => {
      staged = args[1];
      expect(staged.startsWith(root)).toBe(false);
      expect(await readFile(staged, "utf8")).toBe("Synthetic patient report");
      if (process.platform !== "win32") {
        expect((await stat(staged)).mode & 0o777).toBe(0o600);
        expect((await stat(path.dirname(staged))).mode & 0o777).toBe(0o700);
      }
      return {
        stdout:
          '{"success":true,"tests":[],"detectedDate":null,"extractedCount":0}',
      };
    });
    expect(
      (
        await parseLabBuffer(
          Buffer.from("Synthetic patient report"),
          "report.pdf"
        )
      ).success
    ).toBe(true);
    expect(staged).not.toBe("");
    await expect(access(path.dirname(staged))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("returns a fixed OCR error without exposing subprocess stderr or exception text", async () => {
    mocks.exec.mockRejectedValue(
      new Error("private report text and command arguments")
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await parseLabFile("/private/report.pdf")).toEqual({
      success: false,
      detectedDate: null,
      tests: [],
      extractedCount: 0,
      error: "Could not read the laboratory report.",
    });
    expect(log).not.toHaveBeenCalled();
  });

  it("runs the patient reader with bundled Python and sends patient contents through stdin", async () => {
    const child = reader();
    const result = readPatientFile("patient list.xlsx", "c3ludGhldGlj");
    expect(mocks.spawn).toHaveBeenCalledWith(
      python,
      [path.join(root, "scripts", "patient_list_reader.py"), "--stdin"],
      {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        cwd: root,
      }
    );
    expect(JSON.parse(child.stdin.read().toString())).toEqual({
      fileName: "patient list.xlsx",
      base64: "c3ludGhldGlj",
    });
    const parsed = {
      success: true,
      rows: [{ firstName: "Synthetic" }],
      unmappedColumns: [],
    };
    child.stdout.write(JSON.stringify(parsed));
    child.emit("close", 0);
    expect(await result).toEqual(parsed);
  });

  it("rejects relative configured interpreter paths instead of searching PATH", async () => {
    vi.stubEnv("KTP_PYTHON", "untrusted-python");
    expect((await parseLabFile("/private/report.pdf")).success).toBe(false);
    expect(await readPatientFile("patients.csv", "eA==")).toMatchObject({
      success: false,
    });
    expect(mocks.exec).not.toHaveBeenCalled();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it("keeps source-runtime defaults when no packaged overrides are configured", async () => {
    delete process.env.KTP_APP_ROOT;
    delete process.env.KTP_PYTHON;
    mocks.exec.mockResolvedValue({ stdout: '{"success":true}' });
    await parseLabFile("/private/report.pdf");
    const command = process.platform === "win32" ? "python" : "python3";
    expect(mocks.exec.mock.calls[0][0]).toBe(command);
    expect(mocks.exec.mock.calls[0][1][0]).toBe(
      path.join(process.cwd(), "scripts", "parse_lab_ocr.py")
    );
    const child = reader();
    const result = readPatientFile("patients.csv", "eA==");
    expect(mocks.spawn.mock.calls[0][0]).toBe(command);
    child.stdout.write('{"success":true}');
    child.emit("close", 0);
    await result;
  });

  it("redacts malformed reader output and private stderr diagnostics", async () => {
    const child = reader();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = readPatientFile("patients.csv", "eA==");
    child.stderr.write("private patient record in Python traceback");
    child.stdout.write("private malformed output");
    child.emit("close", 1);
    expect(await result).toEqual({
      success: false,
      rows: [],
      unmappedColumns: [],
      error: "Could not read the file.",
    });
    expect(log).not.toHaveBeenCalled();
  });

  it("kills a hung reader and returns a bounded timeout failure", async () => {
    vi.useFakeTimers();
    const child = reader();
    const result = readPatientFile("patients.csv", "eA==");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(child.kill).toHaveBeenCalledOnce();
    expect(await result).toMatchObject({
      success: false,
      error: "The file reader timed out.",
    });
    child.stdout.write('{"success":true}');
    child.emit("close", 0);
  });

  it("stops an oversized reader response and handles unavailable Python safely", async () => {
    const child = reader();
    const result = readPatientFile("patients.csv", "eA==");
    child.stdout.write(Buffer.alloc(10 * 1024 * 1024 + 1, 65));
    expect(await result).toMatchObject({
      success: false,
      error: "Could not read the file.",
    });
    expect(child.kill).toHaveBeenCalledOnce();
    const unavailable = reader();
    const missing = readPatientFile("patients.csv", "eA==");
    unavailable.emit("error", new Error("private environment paths"));
    expect(await missing).toMatchObject({
      success: false,
      error: "The file reader is not installed on this server.",
    });
  });
});
