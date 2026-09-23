import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type CookieCall = { name: string; value: string; options: Record<string, unknown> };

function makeCtx(overrides: Partial<TrpcContext> & { req?: Partial<TrpcContext["req"]> } = {}): {
  ctx: TrpcContext;
  cookies: CookieCall[];
} {
  const cookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: null,
    claimNurseId: null,
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
      ...overrides.req,
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
    ...overrides,
  };
  return { ctx, cookies };
}

const adminUser = {
  id: 1,
  openId: "admin-don",
  email: "almanalaysay93@gmail.com",
  name: "Don Admin",
  loginMethod: "google" as const,
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

// Generates 7-digit PRC number with leading zero
const uniquePrc = () => "0" + Math.floor(100000 + Math.random() * 900000);

describe("PRC Upload with Review — Server Validation & Persistence (T2, T3)", () => {
  const smallBase64 = Buffer.from("fake-image-bytes").toString("base64");

  it("allows supervisor to upload document with confirmed fields, updates PRC and marks Pending Verification", async () => {
    const { ctx } = makeCtx({ user: adminUser });
    const caller = appRouter.createCaller(ctx);

    const empId = `TEST-SUP-${Date.now()}-${Math.random()}`;
    const prcNumber = uniquePrc();

    const nurse = await caller.nurses.create({
      employeeId: empId,
      firstName: "Clara",
      lastName: "Reyes",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      dateHired: new Date("2026-01-15").toISOString(),
      licenseNumber: prcNumber,
      licenseExpiryDate: "2027-05-10T00:00:00.000Z",
    });

    const creds = await db.listCredentials({ nurseId: nurse.id });
    const prcCred = creds.find((c) => c.licenseNumber === prcNumber)!;
    expect(prcCred).toBeDefined();

    const newPrcNumber = uniquePrc();
    const res = await caller.credentials.uploadDocument({
      credentialId: prcCred.id,
      fileBase64: smallBase64,
      fileName: "prc-card.jpg",
      mimeType: "image/jpeg",
      confirmedFields: {
        licenseNumber: newPrcNumber,
        issueDate: "2024-05-10",
        expiryDate: "2027-05-10",
      },
    });

    expect(res.url).toBeDefined();

    const updatedCreds = await db.listCredentials({ nurseId: nurse.id });
    const updated = updatedCreds.find((c) => c.id === prcCred.id)!;
    expect(updated.licenseNumber).toBe(newPrcNumber);
    expect(updated.licenseNumber?.startsWith("0")).toBe(true);
    expect(updated.verificationStatus).toBe("Pending Verification");
    expect(updated.documentKey).toBeDefined();
    expect(updated.renewalCycleKey).toContain(String(prcCred.id));
  });

  it("allows staff member to upload document with confirmed fields on their own profile", async () => {
    const { ctx: adminCtx } = makeCtx({ user: adminUser });
    const adminCaller = appRouter.createCaller(adminCtx);

    const empId = `TEST-STAFF-${Date.now()}-${Math.random()}`;
    const prcNumber = uniquePrc();

    const nurse = await adminCaller.nurses.create({
      employeeId: empId,
      firstName: "Juan",
      lastName: "Luna",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      dateHired: new Date("2026-01-15").toISOString(),
      licenseNumber: prcNumber,
      licenseExpiryDate: "2027-05-10T00:00:00.000Z",
    });

    const creds = await db.listCredentials({ nurseId: nurse.id });
    const prcCred = creds.find((c) => c.licenseNumber === prcNumber)!;

    const { ctx } = makeCtx({ claimNurseId: nurse.id });
    const caller = appRouter.createCaller(ctx);

    const updatedPrc = uniquePrc();
    const res = await caller.staffAccount.uploadCredentialDocument({
      credentialId: prcCred.id,
      fileBase64: smallBase64,
      fileName: "juan-prc.png",
      mimeType: "image/png",
      confirmedFields: {
        licenseNumber: updatedPrc,
        issueDate: "2023-01-15",
        expiryDate: "2026-01-15",
      },
    });

    expect(res.url).toBeDefined();

    const updatedCreds = await db.listCredentials({ nurseId: nurse.id });
    const updated = updatedCreds.find((c) => c.id === prcCred.id)!;
    expect(updated.licenseNumber).toBe(updatedPrc);
    expect(updated.verificationStatus).toBe("Pending Verification");
  });

  it("rejects unauthorized credential IDs for staff (cannot upload to another nurse's credential)", async () => {
    const { ctx: adminCtx } = makeCtx({ user: adminUser });
    const adminCaller = appRouter.createCaller(adminCtx);

    const nurse1 = await adminCaller.nurses.create({
      employeeId: `E1-${Date.now()}-${Math.random()}`,
      firstName: "Nurse",
      lastName: "One",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      licenseNumber: uniquePrc(),
      licenseExpiryDate: "2027-05-10T00:00:00.000Z",
    });
    const nurse2 = await adminCaller.nurses.create({
      employeeId: `E2-${Date.now()}-${Math.random()}`,
      firstName: "Nurse",
      lastName: "Two",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      licenseNumber: uniquePrc(),
      licenseExpiryDate: "2027-05-10T00:00:00.000Z",
    });

    const creds2 = await db.listCredentials({ nurseId: nurse2.id });

    // Nurse 1 tries to upload to Nurse 2's credential
    const { ctx } = makeCtx({ claimNurseId: nurse1.id });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.staffAccount.uploadCredentialDocument({
        credentialId: creds2[0].id,
        fileBase64: smallBase64,
        fileName: "hack.jpg",
        mimeType: "image/jpeg",
      })
    ).rejects.toThrow("Credential record not found on your profile.");
  });

  it("rejects another nurse's duplicate PRC license number in confirmed fields", async () => {
    const { ctx: adminCtx } = makeCtx({ user: adminUser });
    const adminCaller = appRouter.createCaller(adminCtx);

    const sharedPrc = uniquePrc();
    await adminCaller.nurses.create({
      employeeId: `DUP1-${Date.now()}-${Math.random()}`,
      firstName: "Elena",
      lastName: "Cruz",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      licenseNumber: sharedPrc,
      licenseExpiryDate: "2027-05-10T00:00:00.000Z",
    });

    const nurse2 = await adminCaller.nurses.create({
      employeeId: `DUP2-${Date.now()}-${Math.random()}`,
      firstName: "Paolo",
      lastName: "Cruz",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      licenseNumber: uniquePrc(),
      licenseExpiryDate: "2027-05-10T00:00:00.000Z",
    });
    const creds2 = await db.listCredentials({ nurseId: nurse2.id });

    const { ctx } = makeCtx({ claimNurseId: nurse2.id });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.staffAccount.uploadCredentialDocument({
        credentialId: creds2[0].id,
        fileBase64: smallBase64,
        fileName: "dup.jpg",
        mimeType: "image/jpeg",
        confirmedFields: {
          licenseNumber: sharedPrc,
        },
      })
    ).rejects.toThrow("Another nurse is already registered with this PRC License Number.");
  });

  it("rejects invalid dates (e.g. invalid calendar date or format)", async () => {
    const { ctx: adminCtx } = makeCtx({ user: adminUser });
    const adminCaller = appRouter.createCaller(adminCtx);

    const nurse = await adminCaller.nurses.create({
      employeeId: `INV-${Date.now()}-${Math.random()}`,
      firstName: "Test",
      lastName: "Date",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      licenseNumber: uniquePrc(),
      licenseExpiryDate: "2027-05-10T00:00:00.000Z",
    });
    const creds = await db.listCredentials({ nurseId: nurse.id });

    const { ctx } = makeCtx({ claimNurseId: nurse.id });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.staffAccount.uploadCredentialDocument({
        credentialId: creds[0].id,
        fileBase64: smallBase64,
        fileName: "test.jpg",
        mimeType: "image/jpeg",
        confirmedFields: {
          issueDate: "2024-02-31", // invalid date (Feb 31)
        },
      })
    ).rejects.toThrow("Invalid calendar date.");
  });

  it("rejects issue date occurring after expiry date", async () => {
    const { ctx: adminCtx } = makeCtx({ user: adminUser });
    const adminCaller = appRouter.createCaller(adminCtx);

    const nurse = await adminCaller.nurses.create({
      employeeId: `ORDER-${Date.now()}-${Math.random()}`,
      firstName: "Order",
      lastName: "Check",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      licenseNumber: uniquePrc(),
      licenseExpiryDate: "2027-05-10T00:00:00.000Z",
    });
    const creds = await db.listCredentials({ nurseId: nurse.id });

    const { ctx } = makeCtx({ user: adminUser });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.credentials.uploadDocument({
        credentialId: creds[0].id,
        fileBase64: smallBase64,
        fileName: "order.jpg",
        mimeType: "image/jpeg",
        confirmedFields: {
          issueDate: "2026-10-01",
          expiryDate: "2025-10-01", // expiry is BEFORE issue
        },
      })
    ).rejects.toThrow("Issue date cannot be after expiry date.");
  });

  it("preserves omitted values when confirmedFields has partial updates", async () => {
    const { ctx: adminCtx } = makeCtx({ user: adminUser });
    const adminCaller = appRouter.createCaller(adminCtx);

    const originalPrc = uniquePrc();
    const nurse = await adminCaller.nurses.create({
      employeeId: `PART-${Date.now()}-${Math.random()}`,
      firstName: "Partial",
      lastName: "Check",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      licenseNumber: originalPrc,
      licenseExpiryDate: "2027-05-10T00:00:00.000Z",
    });
    const creds = await db.listCredentials({ nurseId: nurse.id });
    const origExpiry = creds[0].expiryDate;

    const { ctx } = makeCtx({ user: adminUser });
    const caller = appRouter.createCaller(ctx);

    // Only issueDate provided in confirmedFields
    await caller.credentials.uploadDocument({
      credentialId: creds[0].id,
      fileBase64: smallBase64,
      fileName: "partial.jpg",
      mimeType: "image/jpeg",
      confirmedFields: {
        issueDate: "2024-01-01",
      },
    });

    const updatedCreds = await db.listCredentials({ nurseId: nurse.id });
    // License number should be preserved
    expect(updatedCreds[0].licenseNumber).toBe(originalPrc);
    // Expiry date should be preserved
    expect(new Date(updatedCreds[0].expiryDate).toISOString().slice(0, 10)).toBe(
      new Date(origExpiry).toISOString().slice(0, 10)
    );
  });

  it("rejects oversized file payloads exceeding 10 MB limit", async () => {
    const { ctx: adminCtx } = makeCtx({ user: adminUser });
    const adminCaller = appRouter.createCaller(adminCtx);

    const nurse = await adminCaller.nurses.create({
      employeeId: `BIG-${Date.now()}-${Math.random()}`,
      firstName: "Big",
      lastName: "File",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      licenseNumber: uniquePrc(),
      licenseExpiryDate: "2027-05-10T00:00:00.000Z",
    });
    const creds = await db.listCredentials({ nurseId: nurse.id });

    const { ctx } = makeCtx({ user: adminUser });
    const caller = appRouter.createCaller(ctx);

    // 11 MB buffer
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    const largeBase64 = largeBuffer.toString("base64");

    await expect(
      caller.credentials.uploadDocument({
        credentialId: creds[0].id,
        fileBase64: largeBase64,
        fileName: "huge.jpg",
        mimeType: "image/jpeg",
      })
    ).rejects.toThrow("File too large (max 10 MB).");
  });

  describe("Manual PRC Input for Staff & Supervisor", () => {
    it("allows staff member to manually input PRC details (license number, issue date, expiry date)", async () => {
      const { ctx: adminCtx } = makeCtx({ user: adminUser });
      const adminCaller = appRouter.createCaller(adminCtx);

      const nurse = await adminCaller.nurses.create({
        employeeId: `MAN-STAFF-${Date.now()}-${Math.random()}`,
        firstName: "Manual",
        lastName: "Nurse",
        staffType: "Registered Nurse",
        employmentStatus: "Active",
      });

      const { ctx: staffCtx } = makeCtx({ claimNurseId: nurse.id });
      const staffCaller = appRouter.createCaller(staffCtx);

      const prcNum = "00" + Math.floor(10000 + Math.random() * 90000); // leading zeros
      await staffCaller.staffAccount.updateMyPrcLicense({
        licenseNumber: prcNum,
        issueDate: "2024-04-15",
        expiryDate: "2027-04-15",
      });

      const creds = await db.listCredentials({ nurseId: nurse.id });
      const prc = creds.find((c) => c.licenseNumber === prcNum);
      expect(prc).toBeDefined();
      expect(prc?.licenseNumber).toBe(prcNum);
      expect(prc?.licenseNumber.startsWith("00")).toBe(true);
      expect(prc?.issueDate ? new Date(prc.issueDate).toISOString().slice(0, 10) : "").toBe("2024-04-15");
      expect(prc?.expiryDate ? new Date(prc.expiryDate).toISOString().slice(0, 10) : "").toBe("2027-04-15");
      expect(prc?.verificationStatus).toBe("Pending Verification");
    });

    it("rejects staff manual PRC input when issue date is after expiry date", async () => {
      const { ctx: adminCtx } = makeCtx({ user: adminUser });
      const adminCaller = appRouter.createCaller(adminCtx);

      const nurse = await adminCaller.nurses.create({
        employeeId: `MAN-DATE-${Date.now()}-${Math.random()}`,
        firstName: "Invalid",
        lastName: "DateOrder",
        staffType: "Registered Nurse",
        employmentStatus: "Active",
      });

      const { ctx: staffCtx } = makeCtx({ claimNurseId: nurse.id });
      const staffCaller = appRouter.createCaller(staffCtx);

      await expect(
        staffCaller.staffAccount.updateMyPrcLicense({
          licenseNumber: uniquePrc(),
          issueDate: "2028-01-01",
          expiryDate: "2026-01-01",
        })
      ).rejects.toThrow("Issue date cannot be after expiry date.");
    });

    it("rejects staff manual PRC input when duplicate PRC license exists", async () => {
      const { ctx: adminCtx } = makeCtx({ user: adminUser });
      const adminCaller = appRouter.createCaller(adminCtx);

      const sharedPrc = uniquePrc();
      await adminCaller.nurses.create({
        employeeId: `N1-${Date.now()}-${Math.random()}`,
        firstName: "First",
        lastName: "Nurse",
        staffType: "Registered Nurse",
        employmentStatus: "Active",
        licenseNumber: sharedPrc,
        licenseExpiryDate: "2027-05-10T00:00:00.000Z",
      });

      const nurse2 = await adminCaller.nurses.create({
        employeeId: `N2-${Date.now()}-${Math.random()}`,
        firstName: "Second",
        lastName: "Nurse",
        staffType: "Registered Nurse",
        employmentStatus: "Active",
      });

      const { ctx: staffCtx } = makeCtx({ claimNurseId: nurse2.id });
      const staffCaller = appRouter.createCaller(staffCtx);

      await expect(
        staffCaller.staffAccount.updateMyPrcLicense({
          licenseNumber: sharedPrc,
        })
      ).rejects.toThrow("Another nurse is already registered with this PRC License Number.");
    });

    it("allows supervisor to input PRC details via nurses.update and enforces date validity", async () => {
      const { ctx: adminCtx } = makeCtx({ user: adminUser });
      const adminCaller = appRouter.createCaller(adminCtx);

      const nurse = await adminCaller.nurses.create({
        employeeId: `SUP-MAN-${Date.now()}-${Math.random()}`,
        firstName: "Supervisor",
        lastName: "Managed",
        staffType: "Registered Nurse",
        employmentStatus: "Active",
      });

      const prcNum = uniquePrc();
      await adminCaller.nurses.update({
        id: nurse.id,
        licenseNumber: prcNum,
        licenseIssueDate: "2024-02-01T00:00:00.000Z",
        licenseExpiryDate: "2027-02-01T00:00:00.000Z",
      });

      const creds = await db.listCredentials({ nurseId: nurse.id });
      const prc = creds.find((c) => c.licenseNumber === prcNum);
      expect(prc).toBeDefined();
      expect(prc?.verificationStatus).toBe("Pending Verification");

      // Verify date ordering enforcement
      await expect(
        adminCaller.nurses.update({
          id: nurse.id,
          licenseIssueDate: "2028-02-01T00:00:00.000Z",
          licenseExpiryDate: "2027-02-01T00:00:00.000Z",
        })
      ).rejects.toThrow("Issue date cannot be after expiry date.");
    });
  });

  describe("PRC OCR Review & Repair Plan — F1 to F9 Regressions", () => {
    it("F1: Date-only updates preserve PRC number without setting to null", async () => {
      const { ctx: adminCtx } = makeCtx({ user: adminUser });
      const adminCaller = appRouter.createCaller(adminCtx);

      const prcNumber = "0012345";
      const nurse = await adminCaller.nurses.create({
        employeeId: `F1-${Date.now()}-${Math.random()}`,
        firstName: "F1",
        lastName: "Nurse",
        staffType: "Registered Nurse",
        employmentStatus: "Active",
        licenseNumber: prcNumber,
        licenseExpiryDate: "2027-01-01T00:00:00.000Z",
      });

      const { ctx: staffCtx } = makeCtx({ claimNurseId: nurse.id });
      const staffCaller = appRouter.createCaller(staffCtx);

      // Updating only expiry date
      await staffCaller.staffAccount.updateMyPrcLicense({
        expiryDate: "2028-05-10",
      });

      const creds = await db.listCredentials({ nurseId: nurse.id });
      const prc = creds[0];
      expect(prc.licenseNumber).toBe("0012345");
      expect(prc.expiryDate).toContain("2028-05-10");

      // Explicit null clears the number
      await staffCaller.staffAccount.updateMyPrcLicense({
        licenseNumber: null,
      });
      const credsAfterClear = await db.listCredentials({ nurseId: nurse.id });
      expect(credsAfterClear[0].licenseNumber).toBeNull();
    });

    it("F2: Rejects invalid date combinations against retained values and rejects explicit null expiry", async () => {
      const { ctx: adminCtx } = makeCtx({ user: adminUser });
      const adminCaller = appRouter.createCaller(adminCtx);

      const nurse = await adminCaller.nurses.create({
        employeeId: `F2-${Date.now()}-${Math.random()}`,
        firstName: "F2",
        lastName: "Nurse",
        staffType: "Registered Nurse",
        employmentStatus: "Active",
        licenseNumber: uniquePrc(),
        licenseExpiryDate: "2027-01-01T00:00:00.000Z",
      });

      const { ctx: staffCtx } = makeCtx({ claimNurseId: nurse.id });
      const staffCaller = appRouter.createCaller(staffCtx);

      // Rejects issue date (2030) after retained expiry (2027)
      await expect(
        staffCaller.staffAccount.updateMyPrcLicense({
          issueDate: "2030-01-01",
        })
      ).rejects.toThrow("Issue date cannot be after expiry date.");

      // Rejects explicit null expiry
      await expect(
        staffCaller.staffAccount.updateMyPrcLicense({
          expiryDate: null,
        })
      ).rejects.toThrow("Expiry date is required.");

      // Also in uploadDocument confirmedFields
      const creds = await db.listCredentials({ nurseId: nurse.id });
      await expect(
        adminCaller.credentials.uploadDocument({
          credentialId: creds[0].id,
          fileBase64: smallBase64,
          fileName: "test.jpg",
          mimeType: "image/jpeg",
          confirmedFields: {
            issueDate: "2030-01-01",
          },
        })
      ).rejects.toThrow("Issue date cannot be after expiry date.");

      await expect(
        adminCaller.credentials.uploadDocument({
          credentialId: creds[0].id,
          fileBase64: smallBase64,
          fileName: "test.jpg",
          mimeType: "image/jpeg",
          confirmedFields: {
            expiryDate: null,
          },
        })
      ).rejects.toThrow("Expiry date is required.");
    });

    it("F3: Explicit credentialId targets only the selected renewal record", async () => {
      const { ctx: adminCtx } = makeCtx({ user: adminUser });
      const adminCaller = appRouter.createCaller(adminCtx);

      const nurse = await adminCaller.nurses.create({
        employeeId: `F3-${Date.now()}-${Math.random()}`,
        firstName: "F3",
        lastName: "Nurse",
        staffType: "Registered Nurse",
        employmentStatus: "Active",
        licenseNumber: "0111111",
        licenseExpiryDate: "2024-01-01T00:00:00.000Z",
      });

      const types = await db.listCredentialTypes(true);
      const prcType = types.find((t) => t.name.toLowerCase().includes("prc")) ?? types[0];

      // Create a second renewal cycle for the same nurse
      const cred2Id = await db.createCredential({
        nurseId: nurse.id,
        credentialTypeId: prcType.id,
        licenseNumber: "0222222",
        issuingOrganization: "PRC",
        expiryDate: new Date("2027-01-01"),
        renewalStatus: "Not Started",
        verificationStatus: "Unverified",
        renewalCycleKey: `cycle-2-${Date.now()}`,
      });

      const { ctx: staffCtx } = makeCtx({ claimNurseId: nurse.id });
      const staffCaller = appRouter.createCaller(staffCtx);

      // Edit only cred2 explicitly
      await staffCaller.staffAccount.updateMyPrcLicense({
        credentialId: cred2Id,
        licenseNumber: "0222222-UPD",
        expiryDate: "2028-01-01",
      });

      const allCreds = await db.listCredentials({ nurseId: nurse.id });
      const cred1 = allCreds.find((c) => c.id !== cred2Id)!;
      const cred2 = allCreds.find((c) => c.id === cred2Id)!;

      // cred1 must be completely untouched
      expect(cred1.licenseNumber).toBe("0111111");
      expect(cred1.expiryDate).toContain("2024-01-01");

      // cred2 must be updated
      expect(cred2.licenseNumber).toBe("0222222-UPD");
      expect(cred2.expiryDate).toContain("2028-01-01");
    });

    it("F7: Name-only and contact-only edits preserve license verification status", async () => {
      const { ctx: adminCtx } = makeCtx({ user: adminUser });
      const adminCaller = appRouter.createCaller(adminCtx);

      const prcNum = uniquePrc();
      const nurse = await adminCaller.nurses.create({
        employeeId: `F7-${Date.now()}-${Math.random()}`,
        firstName: "Maria",
        lastName: "Santos",
        staffType: "Registered Nurse",
        employmentStatus: "Active",
        licenseNumber: prcNum,
        licenseExpiryDate: "2027-05-01T00:00:00.000Z",
      });

      const creds = await db.listCredentials({ nurseId: nurse.id });
      // Mark credential Verified
      await db.updateCredential(creds[0].id, { verificationStatus: "Verified" });
      const verifiedCred = (await db.listCredentials({ nurseId: nurse.id }))[0];
      expect(verifiedCred.verificationStatus).toBe("Verified");

      // Supervisor updates nurse's name and contact number, sending existing PRC fields
      await adminCaller.nurses.update({
        id: nurse.id,
        firstName: "Maria Clara",
        contactNumber: "09170001111",
        licenseNumber: prcNum,
        licenseExpiryDate: "2027-05-01T00:00:00.000Z",
      });

      const credsAfter = await db.listCredentials({ nurseId: nurse.id });
      // Verification status must still be "Verified"
      expect(credsAfter[0].verificationStatus).toBe("Verified");

      // Modifying PRC details changes verification to "Pending Verification"
      await adminCaller.nurses.update({
        id: nurse.id,
        licenseExpiryDate: "2028-05-01T00:00:00.000Z",
      });
      const credsAfterPrcChange = await db.listCredentials({ nurseId: nurse.id });
      expect(credsAfterPrcChange[0].verificationStatus).toBe("Pending Verification");
    });

    it("F9: License creation without explicit expiry date is rejected (no +3 year fabrication)", async () => {
      const { ctx: adminCtx } = makeCtx({ user: adminUser });
      const adminCaller = appRouter.createCaller(adminCtx);

      // Attempting to create a nurse with PRC license number but missing expiry date
      await expect(
        adminCaller.nurses.create({
          employeeId: `F9-${Date.now()}-${Math.random()}`,
          firstName: "F9",
          lastName: "Nurse",
          staffType: "Registered Nurse",
          employmentStatus: "Active",
          licenseNumber: uniquePrc(),
          // licenseExpiryDate is omitted
        })
      ).rejects.toThrow("Expiry date is required when adding a PRC license.");
    });
  });
});
