import { spawn } from "child_process";
import path from "path";
import type { Express } from "express";
import { hasFullAccess } from "./adminAccess";
import { sdk } from "./_core/sdk";

/*
 * POST /api/patient_import on a server that has Python: runs scripts/patient_list_reader.py and
 * returns its JSON. On Vercel the same path goes to the Python function api/patient_import.py,
 * so this route does not run there.
 */

const SCRIPT = path.resolve(process.cwd(), "scripts", "patient_list_reader.py");
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const failed = (error: string) => ({ success: false, rows: [], unmappedColumns: [], error });

/** Runs the reader with the file on stdin. No temporary file holds patient data. */
export function readPatientFile(fileName: string, base64: string): Promise<unknown> {
  return new Promise(resolve => {
    const child = spawn(process.platform === "win32" ? "python" : "python3", [SCRIPT, "--stdin"], { stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    let errors = "";
    const timer = setTimeout(() => child.kill(), 30_000);
    child.stdout.on("data", chunk => (output += chunk));
    child.stderr.on("data", chunk => (errors += chunk));
    child.on("error", () => {
      clearTimeout(timer);
      resolve(failed("The file reader is not installed on this server."));
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(output));
      } catch {
        console.error("[Patient import] reader failed", errors.slice(0, 500));
        resolve(failed("Could not read the file."));
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
      if (!hasFullAccess(user.email)) return res.status(403).json(failed("Admin access is necessary."));
    } catch {
      return res.status(401).json(failed("Sign in again, then upload the file."));
    }
    const fileName = String(req.body?.fileName ?? "").slice(0, 255);
    const base64 = String(req.body?.base64 ?? "").split("base64,").pop() ?? "";
    if (!fileName || !base64) return res.status(400).json(failed("The upload was not complete. Try again."));
    if (Buffer.byteLength(base64, "base64") > MAX_FILE_BYTES) return res.status(413).json(failed("File too large. The maximum size is 3 MB."));
    return res.json(await readPatientFile(fileName, base64));
  });
}
