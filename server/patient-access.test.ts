import Database from "better-sqlite3"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { TrpcContext } from "./_core/context"
import { appRouter } from "./routers"
import * as db from "./db"
import { closeSqliteDb, getSqliteDb } from "./localDb"

describe("Patient Access, Routing, Consent, and Isolation", () => {
  let sqlite: Database.Database

  beforeAll(() => {
    vi.stubEnv("DATABASE_URL", "")
    vi.stubEnv("LOCAL_DB_PATH", ":memory:")
    sqlite = getSqliteDb()
  })

  afterAll(() => {
    closeSqliteDb()
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    // Reset mutable tables
    sqlite.exec("DELETE FROM activityLog")
    sqlite.exec("DELETE FROM notifications")
    sqlite.exec("DELETE FROM patients")
    sqlite.exec("DELETE FROM users")
    sqlite.exec("DELETE FROM doctors")
    sqlite.exec("DELETE FROM appSettings")
    sqlite.exec("INSERT OR REPLACE INTO appSettings (key, value) VALUES ('consentVersion', '1')")
    sqlite.exec("INSERT OR REPLACE INTO appSettings (key, value) VALUES ('consentNoticeText', 'KTP Privacy Notice')")
  })

  async function createUser(openId: string, email: string, name = "Test User") {
    await db.upsertUser({ openId, email, name })
    return (await db.getUserByOpenId(openId))!
  }

  function createAdminContext(email = "almanalaysay93@gmail.com"): TrpcContext {
    const user = {
      id: 1,
      openId: "google-admin-1",
      email,
      name: "Admin User",
      loginMethod: "google",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }
    return {
      user,
      req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as any,
      res: { clearCookie: vi.fn() } as any,
    }
  }

  function createPatientContext(userRow: { id: number; openId: string; email: string | null }, patientId: number): TrpcContext {
    return {
      user: {
        id: userRow.id,
        openId: userRow.openId,
        email: userRow.email,
        name: "Patient User",
        loginMethod: "google",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      patientId,
      req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as any,
      res: { clearCookie: vi.fn() } as any,
    }
  }

  describe("1. Auth Routing & User Linking", () => {
    it("routes admin allowlist email to admin role and dashboard", async () => {
      const adminCtx = createAdminContext("almanalaysay93@gmail.com")
      const caller = appRouter.createCaller(adminCtx)

      const me = await caller.auth.me()
      expect(me).not.toBeNull()
      expect(me?.isAdmin).toBe(true)
      expect(me?.patient).toBeNull()
      expect(me?.consentRequired).toBe(false)
    })

    it("links enrolled active patient case-insensitively and returns patient info", async () => {
      const patient = await db.createPatient({
        hrn: "HRN-001",
        patientType: "Recipient",
        firstName: "Juan",
        lastName: "Dela Cruz",
        accountEmail: "juan.delacruz@gmail.com",
        stage: "Phase1",
        status: "Active",
      })

      const user = await createUser("google-juan-1", "JUAN.DELACRUZ@GMAIL.COM", "Juan Dela Cruz")

      await db.updatePatient(patient.id, { linkedUserId: user.id })

      const patientCtx = createPatientContext(user, patient.id)
      const caller = appRouter.createCaller(patientCtx)

      const me = await caller.auth.me()
      expect(me).not.toBeNull()
      expect(me?.isAdmin).toBe(false)
      expect(me?.patient).not.toBeNull()
      expect(me?.patient?.hrn).toBe("HRN-001")
      expect(me?.patient?.id).toBe(patient.id)
    })

    it("denies access when email is unknown or not enrolled", async () => {
      const user = await createUser("google-unknown", "stranger@gmail.com", "Stranger")

      const strangerCtx: TrpcContext = {
        user,
        req: { protocol: "https", headers: {} } as any,
        res: { clearCookie: vi.fn() } as any,
      }

      const caller = appRouter.createCaller(strangerCtx)
      const me = await caller.auth.me()
      expect(me).not.toBeNull()
      expect(me?.isAdmin).toBe(false)
      expect(me?.patient).toBeNull()
    })

    it("revokes access immediately if patient status is changed from Active", async () => {
      const patient = await db.createPatient({
        hrn: "HRN-002",
        patientType: "Recipient",
        firstName: "Maria",
        lastName: "Clara",
        accountEmail: "maria.clara@gmail.com",
        stage: "Orientation",
        status: "Active",
      })

      const user = await createUser("google-maria", "maria.clara@gmail.com", "Maria Clara")

      await db.updatePatient(patient.id, { linkedUserId: user.id })

      const ctx = createPatientContext(user, patient.id)
      const caller = appRouter.createCaller(ctx)

      let me = await caller.auth.me()
      expect(me?.patient).not.toBeNull()

      // Patient is archived to Inactive
      await db.updatePatient(patient.id, { status: "Inactive" })

      me = await caller.auth.me()
      expect(me?.patient).toBeNull()
    })

    it("revokes access immediately if patient accountEmail changes", async () => {
      const patient = await db.createPatient({
        hrn: "HRN-003",
        patientType: "Recipient",
        firstName: "Pedro",
        lastName: "Penduko",
        accountEmail: "pedro.old@gmail.com",
        stage: "Orientation",
        status: "Active",
      })

      const user = await createUser("google-pedro", "pedro.old@gmail.com", "Pedro Penduko")

      await db.updatePatient(patient.id, { linkedUserId: user.id })

      const ctx = createPatientContext(user, patient.id)
      const caller = appRouter.createCaller(ctx)

      let me = await caller.auth.me()
      expect(me?.patient).not.toBeNull()

      // Admin updates patient email
      await db.updatePatient(patient.id, { accountEmail: "pedro.new@gmail.com" })

      me = await caller.auth.me()
      expect(me?.patient).toBeNull()
    })
  })

  describe("2. Versioned Consent Gate", () => {
    it("requires consent on first visit and blocks patientProcedure with CONSENT_REQUIRED", async () => {
      const patient = await db.createPatient({
        hrn: "HRN-004",
        patientType: "Recipient",
        firstName: "Ana",
        lastName: "Santos",
        accountEmail: "ana.santos@gmail.com",
        stage: "Phase1",
        status: "Active",
      })

      const user = await createUser("google-ana", "ana.santos@gmail.com", "Ana Santos")

      await db.updatePatient(patient.id, { linkedUserId: user.id })

      const ctx = createPatientContext(user, patient.id)
      const caller = appRouter.createCaller(ctx)

      const me = await caller.auth.me()
      expect(me?.consentRequired).toBe(true)

      // patientProcedure must throw FORBIDDEN with CONSENT_REQUIRED
      await expect(caller.patientPortal.getMyProfile()).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: expect.stringContaining("CONSENT_REQUIRED"),
      })

      // Patient accepts consent via auth.acceptConsent (allowed by patientBaseProcedure)
      const acceptRes = await caller.auth.acceptConsent()
      expect(acceptRes.success).toBe(true)
      expect(acceptRes.consentVersion).toBe(1)

      // Calling patientProcedure now succeeds
      const profile = await caller.patientPortal.getMyProfile()
      expect(profile.patient.hrn).toBe("HRN-004")

      // Verify activityLog has record
      const logs = sqlite.prepare("SELECT * FROM activityLog WHERE action = 'ACCEPT_CONSENT'").all() as any[]
      expect(logs.length).toBe(1)
      expect(logs[0].patientId).toBe(patient.id)
    })

    it("re-prompts for consent when admin bumps consentVersion in settings", async () => {
      const patient = await db.createPatient({
        hrn: "HRN-005",
        patientType: "Recipient",
        firstName: "Jose",
        lastName: "Rizal",
        accountEmail: "jose.rizal@gmail.com",
        stage: "Phase1",
        status: "Active",
        consentVersion: 1,
        consentAcceptedAt: new Date(),
      })

      const user = await createUser("google-jose", "jose.rizal@gmail.com", "Jose Rizal")

      await db.updatePatient(patient.id, { linkedUserId: user.id })

      const ctx = createPatientContext(user, patient.id)
      const caller = appRouter.createCaller(ctx)

      // Initial call succeeds
      const p1 = await caller.patientPortal.getMyProfile()
      expect(p1.patient.hrn).toBe("HRN-005")

      // Admin bumps version to 2
      const adminCtx = createAdminContext()
      const adminCaller = appRouter.createCaller(adminCtx)
      await adminCaller.settings.update({ consentVersion: 2 })

      // Next call by patient throws CONSENT_REQUIRED
      await expect(caller.patientPortal.getMyProfile()).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: expect.stringContaining("CONSENT_REQUIRED"),
      })

      // Accepting version 2 restores access
      await caller.auth.acceptConsent()
      const p2 = await caller.patientPortal.getMyProfile()
      expect(p2.patient.hrn).toBe("HRN-005")
    })
  })

  describe("3. Patient Isolation", () => {
    it("prevents patient from accessing another patient's data", async () => {
      const p1 = await db.createPatient({
        hrn: "HRN-010",
        patientType: "Recipient",
        firstName: "Patient",
        lastName: "One",
        accountEmail: "p1@gmail.com",
        stage: "Orientation",
        status: "Active",
        consentVersion: 1,
        consentAcceptedAt: new Date(),
      })

      const p2 = await db.createPatient({
        hrn: "HRN-020",
        patientType: "Donor",
        firstName: "Patient",
        lastName: "Two",
        accountEmail: "p2@gmail.com",
        stage: "Orientation",
        status: "Active",
        consentVersion: 1,
        consentAcceptedAt: new Date(),
      })

      const user1 = await createUser("google-p1", "p1@gmail.com")
      const user2 = await createUser("google-p2", "p2@gmail.com")

      await db.updatePatient(p1.id, { linkedUserId: user1.id })
      await db.updatePatient(p2.id, { linkedUserId: user2.id })

      const caller1 = appRouter.createCaller(createPatientContext(user1, p1.id))
      const caller2 = appRouter.createCaller(createPatientContext(user2, p2.id))

      // Caller 1 sees only Patient 1
      const res1 = await caller1.patientPortal.getMyProfile()
      expect(res1.patient.id).toBe(p1.id)
      expect(res1.patient.hrn).toBe("HRN-010")

      // Caller 2 sees only Patient 2
      const res2 = await caller2.patientPortal.getMyProfile()
      expect(res2.patient.id).toBe(p2.id)
      expect(res2.patient.hrn).toBe("HRN-020")

      // Caller 1 updates mobile number
      await caller1.patientPortal.updateContact({ contactNumber: "09171111111" })

      // Verify DB: p1 is updated, p2 is not
      const refreshedP1 = await db.getPatientById(p1.id)
      const refreshedP2 = await db.getPatientById(p2.id)
      expect(refreshedP1?.contactNumber).toBe("09171111111")
      expect(refreshedP2?.contactNumber).toBeNull()

      // Patient cannot access admin procedures
      await expect(caller1.patients.list({})).rejects.toMatchObject({
        code: "FORBIDDEN",
      })
      await expect(caller1.patients.getById({ id: p2.id })).rejects.toMatchObject({
        code: "FORBIDDEN",
      })
      await expect(
        caller1.doctors.create({ name: "Dr. Test", role: "Nephrologist" })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      })
    })
  })

  describe("4. Clinical Validations on Enrollment & Editing", () => {
    it("rejects duplicate HRN and duplicate Gmail on enrollment", async () => {
      const adminCtx = createAdminContext()
      const adminCaller = appRouter.createCaller(adminCtx)

      await adminCaller.patients.create({
        hrn: "HRN-UNIQUE-1",
        patientType: "Recipient",
        firstName: "First",
        lastName: "Person",
        accountEmail: "unique1@gmail.com",
        stage: "Orientation",
        status: "Active",
      })

      // Duplicate HRN
      await expect(
        adminCaller.patients.create({
          hrn: "HRN-UNIQUE-1",
          patientType: "Donor",
          firstName: "Second",
          lastName: "Person",
          accountEmail: "different@gmail.com",
          stage: "Orientation",
          status: "Active",
          linkedRecipientId: 1,
        })
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: expect.stringContaining("HRN already exists"),
      })

      // Duplicate Gmail
      await expect(
        adminCaller.patients.create({
          hrn: "HRN-UNIQUE-2",
          patientType: "Recipient",
          firstName: "Third",
          lastName: "Person",
          accountEmail: "unique1@gmail.com",
          stage: "Orientation",
          status: "Active",
        })
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: expect.stringContaining("already enrolled"),
      })
    })

    it("rejects admin allowlist email for patient enrollment", async () => {
      const adminCtx = createAdminContext()
      const adminCaller = appRouter.createCaller(adminCtx)

      await expect(
        adminCaller.patients.create({
          hrn: "HRN-ADMIN-FAIL",
          patientType: "Recipient",
          firstName: "Admin",
          lastName: "Clone",
          accountEmail: "almanalaysay93@gmail.com",
          stage: "Orientation",
          status: "Active",
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("admin email allowlist"),
      })
    })

    it("rejects stages invalid for patient type", async () => {
      const adminCtx = createAdminContext()
      const adminCaller = appRouter.createCaller(adminCtx)

      // Donors do not have PhilHealthZ stage
      await expect(
        adminCaller.patients.create({
          hrn: "HRN-STAGE-FAIL",
          patientType: "Donor",
          firstName: "Donor",
          lastName: "Test",
          accountEmail: "donor.stage@gmail.com",
          stage: "PhilHealthZ" as any,
          status: "Active",
          linkedRecipientId: 1,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("not valid for patient type 'Donor'"),
      })
    })

    it("rejects PostKT and PostDonation without surgeryDate", async () => {
      const adminCtx = createAdminContext()
      const adminCaller = appRouter.createCaller(adminCtx)

      await expect(
        adminCaller.patients.create({
          hrn: "HRN-SURGERY-FAIL",
          patientType: "Recipient",
          firstName: "Transplant",
          lastName: "Recipient",
          accountEmail: "postkt.nosurgery@gmail.com",
          stage: "PostKT",
          status: "Active",
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("Surgery date is required"),
      })
    })

    it("logs VIEW_PATIENT_PROFILE in activityLog when admin views patient details", async () => {
      const adminCtx = createAdminContext()
      const adminCaller = appRouter.createCaller(adminCtx)

      const enrolled = await adminCaller.patients.create({
        hrn: "HRN-AUDIT-1",
        patientType: "Recipient",
        firstName: "Audit",
        lastName: "Subject",
        accountEmail: "audit.test@gmail.com",
        stage: "Orientation",
        status: "Active",
      })

      // View profile
      const detail = await adminCaller.patients.getById({ id: enrolled.id })
      expect(detail.patient.hrn).toBe("HRN-AUDIT-1")

      // Check activityLog
      const auditRows = sqlite
        .prepare("SELECT * FROM activityLog WHERE action = 'VIEW_PATIENT_PROFILE' AND patientId = ?")
        .all(enrolled.id) as any[]
      expect(auditRows.length).toBeGreaterThan(0)
    })
  })
})
