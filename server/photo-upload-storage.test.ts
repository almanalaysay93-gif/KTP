import { describe, expect, it } from "vitest";
import { validateMime } from "../shared/nursetrack";
import * as db from "./db";
import { storagePut } from "./storage";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function makeCtx(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: null,
    claimNurseId: null,
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

describe("Photo Upload & Storage Fallback", () => {
  describe("MIME validation & extension inference", () => {
    it("accepts standard photo mime types", () => {
      expect(validateMime("image/jpeg", "photo").ok).toBe(true);
      expect(validateMime("image/png", "photo").ok).toBe(true);
      expect(validateMime("image/webp", "photo").ok).toBe(true);
      expect(validateMime("image/gif", "photo").ok).toBe(true);
      expect(validateMime("image/heic", "photo").ok).toBe(true);
      expect(validateMime("image/heif", "photo").ok).toBe(true);
    });

    it("infers mime from filename when mime is generic octet-stream or missing", () => {
      expect(validateMime("application/octet-stream", "photo", "camera_shot.jpg").ok).toBe(true);
      expect(validateMime("", "photo", "nurse_avatar.png").ok).toBe(true);
      expect(validateMime(undefined, "photo", "ios_photo.heic").ok).toBe(true);
      expect(validateMime("application/octet-stream", "photo", "document.pdf").ok).toBe(false);
    });

    it("rejects non-image types for photo upload", () => {
      expect(validateMime("application/pdf", "photo").ok).toBe(false);
      expect(validateMime("text/plain", "photo").ok).toBe(false);
      expect(validateMime("application/zip", "photo").ok).toBe(false);
    });
  });

  describe("Database file storage fallback", () => {
    it("saves and retrieves files via db.saveStoredFile and db.getStoredFile", async () => {
      const testKey = `test-file-${Date.now()}.jpg`;
      const testData = Buffer.from("fake-jpg-binary-content").toString("base64");
      const mime = "image/jpeg";
      const size = Buffer.byteLength(testData, "base64");

      await db.saveStoredFile(testKey, testData, mime, size);

      const retrieved = await db.getStoredFile(testKey);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.key).toBe(testKey);
      expect(retrieved?.data).toBe(testData);
      expect(retrieved?.mimeType).toBe(mime);
      expect(retrieved?.fileSize).toBe(size);
    });

    it("storagePut writes to database fallback and returns a /storage/{key} URL", async () => {
      const relKey = `nursetrack/profile-photos/nurse-999-${Date.now()}-avatar.jpg`;
      const binaryData = Buffer.from("photo-pixels-12345");
      const { key, url } = await storagePut(relKey, binaryData, "image/jpeg");

      expect(url).toBe(`/storage/${key}`);
      const stored = await db.getStoredFile(key);
      expect(stored).not.toBeNull();
      expect(stored?.key).toBe(key);
      expect(Buffer.from(stored!.data, "base64").toString()).toBe("photo-pixels-12345");
    });
  });

  describe("Staff photo upload via staffAccount.uploadMyPhoto", () => {
    it("successfully uploads and links nurse photo in staff self-service", async () => {
      // Create a test nurse in local db
      const employeeId = `TEST-EMP-${Date.now()}`;
      const nurseId = await db.createNurse({
        employeeId,
        firstName: "Staff",
        lastName: "Nurse",
        employmentStatus: "Active",
      });

      const ctx = makeCtx({ claimNurseId: nurseId });
      const caller = appRouter.createCaller(ctx);

      const photoPayload = {
        fileBase64: Buffer.from("simulated-jpeg-bytes").toString("base64"),
        fileName: "profile.jpg",
        mimeType: "image/jpeg",
      };

      const res = await caller.staffAccount.uploadMyPhoto(photoPayload);
      expect(res.url).toMatch(/^\/storage\/nursetrack\/profile-photos\//);

      // Verify nurse was updated in DB
      const updatedNurse = await db.getNurseById(nurseId);
      expect(updatedNurse?.profilePhotoKey).toBeTruthy();
      expect(`/storage/${updatedNurse?.profilePhotoKey}`).toBe(res.url);

      // Verify photo data exists in storage
      const stored = await db.getStoredFile(updatedNurse!.profilePhotoKey!);
      expect(stored).not.toBeNull();
      expect(stored?.mimeType).toBe("image/jpeg");
    });
  });
});
