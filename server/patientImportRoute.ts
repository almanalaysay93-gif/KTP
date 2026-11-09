import { spawn } from "node:child_process";
import path from "path";
import type { Express } from "express";
import { hasFullAccess } from "./adminAccess";
import { sdk } from "./_core/sdk";

/*
 * POST /api/patient_import on a server that has Python: runs scripts/patient_list_reader.py and
 * returns its JSON. On Vercel the same path goes to the Python function api/patient_import.py,
 * so this route does not run there.
 */

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const failed = (error: string) => ({
  success: false,
  rows: [],
  unmappedColumns: [],
  error,
});

/** Runs the reader with the file on stdin. No temporary file holds patient data. */
export function readPatientFile(
  fileName: string,
  base64: string
): Promise<unknown> {
  return new Promise(resolve => {
    const root = process.env.KTP_APP_ROOT || process.cwd();
    const script = path.resolve(root, "scripts", "patient_list_reader.py");
    const python =
      process.env.KTP_PYTHON ||
      (process.platform === "win32" ? "python" : "python3");
    if (process.env.KTP_PYTHON && !path.isAbsolute(python)) {
      resolve(failed("The file reader is not installed on this server."));
      return;
    }
    const child = spawn(python, [script, "--stdin"], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      cwd: root,
    });
    let output = "";
    let bytes = 0;
    let finished = false;
    const finish = (result: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(failed("The file reader timed out."));
    }, 30_000);
    child.stdout.on("data", chunk => {
      if (finished) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > 10 * 1024 * 1024) {
        child.kill();
        finish(failed("Could not read the file."));
      } else {
        output += chunk;
      }
    });
    // Python diagnostics can include raw patient text. Drain without logging.
    child.stderr.resume();
    child.on("error", () => {
      finish(failed("The file reader is not installed on this server."));
    });
    child.on("close", () => {
      try {
        finish(JSON.parse(output));
      } catch {
        finish(failed("Could not read the file."));
      }
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(JSON.stringify({ fileName, base64 }));
  });
}

export function registerPatientImportRoute(app: Express) {
  app.post("/api/patient_import", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const user = await sdk.authenticateRequest(req);
      if (!hasFullAccess(user.email))
        return res.status(403).json(failed("Admin access is necessary."));
    } catch {
      return res
        .status(401)
        .json(failed("Sign in again, then upload the file."));
    }
    const fileName = String(req.body?.fileName ?? "").slice(0, 255);
    const base64 =
      String(req.body?.base64 ?? "")
        .split("base64,")
        .pop() ?? "";
    if (!fileName || !base64)
      return res
        .status(400)
        .json(failed("The upload was not complete. Try again."));
    if (Buffer.byteLength(base64, "base64") > MAX_FILE_BYTES)
      return res
        .status(413)
        .json(failed("File too large. The maximum size is 3 MB."));
    return res.json(await readPatientFile(fileName, base64));
  });
}
