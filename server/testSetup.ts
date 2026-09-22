import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll } from "vitest";
import { closeSqliteDb } from "./localDb";

// Reject external database & storage configurations during tests (F8)
delete process.env.DATABASE_URL;
delete process.env.AWS_S3_BUCKET;
delete process.env.S3_BUCKET_NAME;

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nursetrack-test-"));
const tempDbPath = path.join(tempDir, "test.db");

// If application local.db exists, copy its baseline schema and seeds so tests don't modify it.
const canonicalDb = path.join(import.meta.dirname, "data", "local.db");
if (fs.existsSync(canonicalDb)) {
  try {
    fs.copyFileSync(canonicalDb, tempDbPath);
  } catch {
    // Falls back to fresh schema/seed if copy fails
  }
}

process.env.LOCAL_DB_PATH = tempDbPath;

afterAll(() => {
  closeSqliteDb();
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors on busy Windows handles
  }
});
