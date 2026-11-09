import assert from "node:assert/strict";
import postgres from "postgres";
import { SignJWT } from "jose";
import type { TrpcContext } from "../../server/_core/context";

export async function testPatientLabs(
  pg: ReturnType<typeof postgres>,
  origin: string,
  adminHeaders: Record<string, string>
) {
  const { appRouter } = await import("../../server/routers");
  const previousConsent =
    await pg`SELECT value FROM ktp."appSettings" WHERE key='consentVersion'`;
  const consentVersion = previousConsent.length
    ? Number(previousConsent[0].value)
    : 1;
  assert.ok(
    Number.isInteger(consentVersion) && consentVersion > 0,
    "Fixture requires valid current consent configuration"
  );
  const userIds: number[] = [];
  const patientIds: number[] = [];
  const labIds: number[] = [];
  try {
    const [user] = await pg`INSERT INTO ktp.users ("openId",name,email,role)
      VALUES ('patient-labs-user','Synthetic Lab Patient','patient-labs@example.invalid','user') RETURNING *`;
    userIds.push(user.id);
    const [patient, victim] = await pg`INSERT INTO ktp.patients
      (hrn,"patientType","firstName","lastName",stage,"accountEmail","linkedUserId","consentVersion","consentAcceptedAt") VALUES
      ('PATIENT-LABS','Recipient','Synthetic','LabPatient','Phase1','patient-labs@example.invalid',${user.id},${consentVersion},CURRENT_TIMESTAMP),
      ('PATIENT-LABS-VICTIM','Recipient','Synthetic','OtherPatient','Phase1','other-labs@example.invalid',NULL,${consentVersion},CURRENT_TIMESTAMP)
      RETURNING id`;
    patientIds.push(patient.id, victim.id);
    const labs =
      await pg`INSERT INTO ktp."labTests" (name,unit,low,high,active) VALUES
      ('Patient Upload Low','u','3','8',true),('Patient Upload Normal','u','3','8',true),
      ('Patient Upload High','u','3','8',true),('Patient Upload Inactive','u','3','8',false) RETURNING *`;
    labIds.push(...labs.map(lab => lab.id));
    const [planned] = await pg`INSERT INTO ktp."serviceRecords"
      ("patientId","serviceType",label,status,"dueDate",phase,note)
      VALUES (${patient.id},'Laboratory','Existing nurse plan','Planned','2024-03-01','Phase1','Keep planned') RETURNING *`;
    const [catalog] =
      await pg`SELECT id FROM ktp."checklistCatalog" WHERE active AND category='Lab' ORDER BY id LIMIT 1`;
    assert.ok(catalog, "Clinical fixture must include a lab checklist item");
    await pg`INSERT INTO ktp."patientChecklist" ("patientId","catalogId",status) VALUES (${patient.id},${catalog.id},'Pending')`;
    const token = await new SignJWT({
      openId: user.openId,
      role: "admin",
      patientId: victim.id,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
    const headers = {
      cookie: `app_session_id=${token}`,
      "user-agent": "KTP patient lab fixture",
      "x-ktp-client-ip": "192.0.2.45",
    };
    const caller = appRouter.createCaller({
      user,
      patientId: victim.id,
      req: { headers, ip: "192.0.2.45" },
      res: {},
    } as unknown as TrpcContext);
    const post = (
      body: unknown,
      requestHeaders: Record<string, string> = headers
    ) =>
      fetch(`${origin}/api/rust/patient/labs`, {
        method: "POST",
        headers: { ...requestHeaders, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const snapshot = async () => {
      const services =
        await pg`SELECT to_jsonb(s) AS row FROM ktp."serviceRecords" s WHERE "patientId"=${patient.id} ORDER BY id`;
      const results =
        await pg`SELECT to_jsonb(r) AS row FROM ktp."labResults" r JOIN ktp."serviceRecords" s ON s.id=r."serviceRecordId" WHERE s."patientId"=${patient.id} ORDER BY r.id`;
      const audits =
        await pg`SELECT to_jsonb(a) AS row FROM ktp."activityLog" a WHERE "patientId"=${patient.id} ORDER BY id`;
      const checklist =
        await pg`SELECT to_jsonb(c) AS row FROM ktp."patientChecklist" c WHERE "patientId"=${patient.id} ORDER BY id`;
      return {
        services: services.map(r => r.row),
        results: results.map(r => r.row),
        audits: audits.map(r => r.row),
        checklist: checklist.map(r => r.row),
      };
    };
    const input = {
      serviceDate: "2024-02-29",
      note: "  Morning self report  ",
      items: [
        { labTestId: labs[0].id, value: " 2 " },
        { labTestId: labs[1].id, value: "5" },
        { labTestId: labs[2].id, value: "9" },
      ],
    };
    const saved = await caller.patientPortal.submitPatientLab(input);
    assert.equal(saved.success, true);
    assert.equal(typeof saved.recordId, "number");
    const [record] =
      await pg`SELECT *,"dueDate"::text AS due,"serviceDate"::text AS completed FROM ktp."serviceRecords" WHERE id=${saved.recordId!}`;
    assert.equal(
      record.patientId,
      patient.id,
      "JWT/context patientId must not select another patient's chart"
    );
    assert.equal(record.serviceType, "Laboratory");
    assert.equal(record.label, "Patient self-uploaded lab report");
    assert.equal(record.status, "Done");
    assert.equal(record.phase, null);
    assert.equal(record.due, input.serviceDate);
    assert.equal(record.completed, input.serviceDate);
    assert.ok(record.note.startsWith("[Patient Upload]"));
    assert.ok(record.note.includes("Morning self report"));
    assert.ok(!record.note.includes("Approved by Nurse"));
    const [unchangedPlan] =
      await pg`SELECT * FROM ktp."serviceRecords" WHERE id=${planned.id}`;
    assert.deepEqual({ ...unchangedPlan }, { ...planned });
    const results =
      await pg`SELECT "labTestId",value,"lowSnapshot","highSnapshot",flag FROM ktp."labResults" WHERE "serviceRecordId"=${saved.recordId!} ORDER BY "labTestId"`;
    assert.deepEqual(
      results.map(row => ({ ...row })),
      labs.slice(0, 3).map((lab, index) => ({
        labTestId: lab.id,
        value: ["2", "5", "9"][index],
        lowSnapshot: "3",
        highSnapshot: "8",
        flag: ["Low", "Normal", "High"][index],
      }))
    );
    const [audit] =
      await pg`SELECT * FROM ktp."activityLog" WHERE "patientId"=${patient.id} AND action='PATIENT_UPLOAD_LAB' ORDER BY id DESC LIMIT 1`;
    assert.equal(audit.actorUserId, user.id);
    assert.equal(audit.patientId, patient.id);
    assert.deepEqual(JSON.parse(audit.details), {
      serviceDate: input.serviceDate,
      testCount: 3,
    });
    assert.equal(audit.ipAddress, "192.0.2.45");
    assert.equal(audit.userAgent, "KTP patient lab fixture");
    const [checklist] =
      await pg`SELECT status,"doneDate" FROM ktp."patientChecklist" WHERE "patientId"=${patient.id} AND "catalogId"=${catalog.id}`;
    assert.equal(checklist.status, "Pending");
    assert.equal(checklist.doneDate, null);
    const clinical = await caller.patientPortal.getMyClinical();
    assert.ok(
      clinical.services.some(
        service => service.id === saved.recordId && service.phase === null
      )
    );
    const uploadedResults = clinical.labResults.filter(
      result => result.serviceRecordId === saved.recordId
    );
    assert.equal(uploadedResults.length, 3);
    assert.deepEqual(uploadedResults.map(result => result.flag).sort(), [
      "High",
      "Low",
      "Normal",
    ]);
    const second = await caller.patientPortal.submitPatientLab({
      serviceDate: input.serviceDate,
      items: [input.items[0]],
    });
    assert.notEqual(second.recordId, saved.recordId);
    const [defaultNote] =
      await pg`SELECT note FROM ktp."serviceRecords" WHERE id=${second.recordId!}`;
    assert.equal(
      defaultNote.note,
      "[Patient Upload] Pending clinical verification"
    );

    const rustUrl = process.env.RUST_BACKEND_URL;
    try {
      process.env.RUST_BACKEND_URL = "";
      const node = await caller.patientPortal.submitPatientLab(input);
      const projection = async (id: number) => {
        const [service] =
          await pg`SELECT to_jsonb(s)-'id'-'createdAt'-'updatedAt' AS row FROM ktp."serviceRecords" s WHERE id=${id}`;
        const values =
          await pg`SELECT "labTestId",value,"lowSnapshot","highSnapshot",flag FROM ktp."labResults" WHERE "serviceRecordId"=${id} ORDER BY "labTestId"`;
        return {
          service: service.row,
          values: values.map(value => ({ ...value })),
        };
      };
      assert.deepEqual(
        await projection(node.recordId),
        await projection(saved.recordId!)
      );
      const [nodeAudit] =
        await pg`SELECT * FROM ktp."activityLog" WHERE "patientId"=${patient.id} AND action='PATIENT_UPLOAD_LAB' ORDER BY id DESC LIMIT 1`;
      assert.equal(nodeAudit.actorUserId, audit.actorUserId);
      assert.equal(nodeAudit.ipAddress, audit.ipAddress);
      assert.equal(nodeAudit.userAgent, audit.userAgent);
      assert.deepEqual(
        JSON.parse(nodeAudit.details),
        JSON.parse(audit.details)
      );
      const beforeFailure = await snapshot();
      await assert.rejects(() =>
        caller.patientPortal.submitPatientLab({
          serviceDate: input.serviceDate,
          items: [input.items[0], { labTestId: labs[3].id, value: "5" }],
        })
      );
      assert.deepEqual(await snapshot(), beforeFailure);
    } finally {
      process.env.RUST_BACKEND_URL = rustUrl;
    }
    const beforeErrors = await snapshot();
    await assert.rejects(
      () =>
        caller.patientPortal.submitPatientLab({
          serviceDate: input.serviceDate,
          items: [{ labTestId: 2147483647, value: "5" }],
        }),
      error => (error as { code: string }).code === "NOT_FOUND"
    );
    const minimal = { serviceDate: input.serviceDate, items: [input.items[0]] };
    for (const [index, invalid] of [
      {
        ...minimal,
        items: [input.items[0], { labTestId: labs[3].id, value: "5" }],
      },
      { ...minimal, items: [input.items[0], input.items[0]] },
      { ...minimal, items: [] },
      { ...minimal, serviceDate: "2999-01-01" },
      { ...minimal, serviceDate: "2024-02-30" },
      { ...minimal, serviceDate: "1899-12-31" },
      { ...minimal, items: Array.from({ length: 101 }, () => input.items[0]) },
      {
        ...minimal,
        items: [{ labTestId: labs[0].id, value: "x".repeat(101) }],
      },
      { ...minimal, items: [{ labTestId: labs[0].id, value: "  " }] },
      { ...minimal, note: "x".repeat(1001) },
      { ...minimal, patientId: victim.id },
      { ...minimal, nurseApproved: true },
      { ...minimal, phase: "Phase1" },
    ].entries()) {
      assert.equal((await post(invalid)).status, index === 0 ? 404 : 400);
      assert.deepEqual(
        await snapshot(),
        beforeErrors,
        "Invalid uploads must leave services/results/audit/checklist unchanged"
      );
    }
    const form = await fetch(`${origin}/api/rust/patient/labs`, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "serviceDate=2024-02-29",
    });
    assert.equal(form.status, 415);
    assert.equal((await post(minimal, {})).status, 401);
    assert.equal((await post(minimal, adminHeaders)).status, 401);
    assert.equal(
      (await fetch(`${origin}/api/rust/patients`, { headers })).status,
      403
    );

    // A database failure after result writes must roll back the entire upload.
    await pg.unsafe(`CREATE FUNCTION ktp.rust_test_patient_lab_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action='PATIENT_UPLOAD_LAB' THEN RAISE EXCEPTION 'Synthetic lab audit rejected'; END IF; RETURN NEW; END $$`);
    await pg.unsafe(`CREATE TRIGGER rust_test_patient_lab_audit_failure BEFORE INSERT ON ktp."activityLog"
      FOR EACH ROW EXECUTE FUNCTION ktp.rust_test_patient_lab_audit_failure()`);
    assert.equal((await post(minimal)).status, 503);
    assert.deepEqual(await snapshot(), beforeErrors);
    await pg.unsafe(
      `DROP TRIGGER rust_test_patient_lab_audit_failure ON ktp."activityLog"`
    );
    await pg.unsafe("DROP FUNCTION ktp.rust_test_patient_lab_audit_failure()");

    await pg`UPDATE ktp.patients SET "consentVersion"=0 WHERE id=${patient.id}`;
    const missingConsent = await post(minimal);
    assert.equal(missingConsent.status, 403);
    assert.deepEqual(await missingConsent.json(), {
      error: "CONSENT_REQUIRED",
    });
    await pg`UPDATE ktp.patients SET "consentVersion"=${consentVersion},"accountEmail"='revoked-labs@example.invalid' WHERE id=${patient.id}`;
    assert.equal((await post(minimal)).status, 401);
    await pg`UPDATE ktp.patients SET "accountEmail"='patient-labs@example.invalid',status='Inactive' WHERE id=${patient.id}`;
    assert.equal((await post(minimal)).status, 401);
    assert.deepEqual(await snapshot(), beforeErrors);
    const [victimCount] =
      await pg`SELECT count(*)::int AS n FROM ktp."serviceRecords" WHERE "patientId"=${victim.id}`;
    assert.equal(victimCount.n, 0);
    console.log(
      "PASS: patient lab upload/readback, independent unverified records, snapshots/flags, audit identity, atomic rollback and access isolation"
    );
  } finally {
    await pg.unsafe(
      `DROP TRIGGER IF EXISTS rust_test_patient_lab_audit_failure ON ktp."activityLog"`
    );
    await pg.unsafe(
      "DROP FUNCTION IF EXISTS ktp.rust_test_patient_lab_audit_failure()"
    );
    for (const patientId of patientIds) {
      await pg`DELETE FROM ktp."labResults" WHERE "serviceRecordId" IN (SELECT id FROM ktp."serviceRecords" WHERE "patientId"=${patientId})`;
      await pg`DELETE FROM ktp."serviceRecords" WHERE "patientId"=${patientId}`;
      await pg`DELETE FROM ktp."patientChecklist" WHERE "patientId"=${patientId}`;
      await pg`DELETE FROM ktp."activityLog" WHERE "patientId"=${patientId}`;
      await pg`DELETE FROM ktp.patients WHERE id=${patientId}`;
    }
    for (const id of userIds) await pg`DELETE FROM ktp.users WHERE id=${id}`;
    for (const id of labIds)
      await pg`DELETE FROM ktp."labTests" WHERE id=${id}`;
  }
}
