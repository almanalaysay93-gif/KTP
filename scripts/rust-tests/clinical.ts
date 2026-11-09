import assert from "node:assert/strict";
import postgres from "postgres";
import type { TrpcContext } from "../../server/_core/context";

export async function testClinicalWrites(
  pg: ReturnType<typeof postgres>,
  origin: string,
  headers: Record<string, string>
) {
  const { clinicalRouter } = await import("../../server/routers/clinical");
  const { listAllAppointments, listZBenefit } = await import(
    "../../server/dbClinical"
  );
  const context = {
    user: { id: 1, email: "almanalaysay93@gmail.com", role: "admin" },
    req: { headers, ip: "192.0.2.30" },
    res: {},
  } as unknown as TrpcContext;
  const caller = clinicalRouter.createCaller(context);
  const [nodePatient, rustPatient, donor] =
    await pg`INSERT INTO ktp.patients (hrn,"patientType","firstName","lastName",stage) VALUES
    ('CLINICAL-NODE','Recipient','Synthetic','Clinical','Phase1'),('CLINICAL-RUST','Recipient','Synthetic','Clinical','Phase1'),('CLINICAL-DONOR','Donor','Synthetic','Donor','Phase1') RETURNING id`;
  const labs =
    await pg`SELECT id,name FROM ktp."labTests" WHERE active ORDER BY id LIMIT 3`;
  await pg`UPDATE ktp."labTests" SET low='3',high='8' WHERE id=${labs[0].id}`;

  const canonical = async (patientId: number) => {
    const services =
      await pg`SELECT to_jsonb(r) AS row FROM (SELECT "serviceType",label,status,"dueDate","serviceDate","claimDeadline","claimFiledDate",phase,note FROM ktp."serviceRecords" WHERE "patientId"=${patientId} ORDER BY id) r`;
    const results =
      await pg`SELECT to_jsonb(r) AS row FROM (SELECT s.label,s.phase,s."serviceDate",r."labTestId",r.value,r."lowSnapshot",r."highSnapshot",r.flag FROM ktp."labResults" r JOIN ktp."serviceRecords" s ON s.id=r."serviceRecordId" WHERE s."patientId"=${patientId} ORDER BY s.id,r."labTestId",r.id) r`;
    const checklist =
      await pg`SELECT to_jsonb(r) AS row FROM (SELECT "catalogId",status,"doneDate",note FROM ktp."patientChecklist" WHERE "patientId"=${patientId} ORDER BY "catalogId") r`;
    const appointments =
      await pg`SELECT to_jsonb(r) AS row FROM (SELECT title,kind,"startsAt",location,note,"cancelledAt" IS NOT NULL AS cancelled FROM ktp.appointments WHERE "patientId"=${patientId} ORDER BY id) r`;
    const revisions =
      await pg`SELECT r.reason,r."userId",r.before,r.after FROM ktp."recordRevisions" r JOIN ktp."serviceRecords" s ON r."entityId"=s.id AND r."entityType"='serviceRecord' WHERE s."patientId"=${patientId} ORDER BY r.id`;
    const audits =
      await pg`SELECT action,details,"actorUserId" FROM ktp."activityLog" WHERE "patientId"=${patientId} ORDER BY id`;
    return {
      services: services.map(r => r.row),
      results: results.map(r => r.row),
      checklist: checklist.map(r => r.row),
      appointments: appointments.map(r => r.row),
      revisions: revisions.map(r => ({
        reason: r.reason,
        userId: r.userId,
        before: JSON.parse(r.before),
        after: JSON.parse(r.after),
      })),
      audits: audits.map(r => {
        const details = JSON.parse(r.details);
        delete details.id;
        delete details.serviceRecordId;
        return { action: r.action, actor: r.actorUserId, details };
      }),
    };
  };
  const savedUrl = process.env.RUST_BACKEND_URL!;
  const invoke = (action: string, input: object) =>
    (caller[action as keyof typeof caller] as (input: object) => Promise<any>)(
      input
    );
  const pair = async (
    action: string,
    input: object,
    references: { node?: object; rust?: object } = {}
  ) => {
    let expected: any;
    process.env.RUST_BACKEND_URL = "";
    try {
      expected = await invoke(action, {
        ...input,
        ...references.node,
        patientId: nodePatient.id,
      });
    } finally {
      process.env.RUST_BACKEND_URL = savedUrl;
    }
    const actual = await invoke(action, {
      ...input,
      ...references.rust,
      patientId: rustPatient.id,
    });
    assert.deepEqual(
      Object.keys(actual).sort(),
      Object.keys(expected).sort(),
      `${action} response shape`
    );
    for (const key of ["count", "changes"])
      if (key in actual) assert.equal(actual[key], expected[key], action);
    assert.deepEqual(
      await canonical(rustPatient.id),
      await canonical(nodePatient.id),
      `${action} Node/Rust persisted parity`
    );
    return { node: expected, rust: actual };
  };
  const reject = async (action: string, input: object, code: string) => {
    const before = await canonical(rustPatient.id);
    await assert.rejects(
      () => invoke(action, { ...input, patientId: rustPatient.id }),
      error => (error as { code: string }).code === code
    );
    assert.deepEqual(
      await canonical(rustPatient.id),
      before,
      `${action} rolled back data, revision and audit`
    );
  };
  const raw = (action: string, body: object, customHeaders = headers) =>
    fetch(`${origin}/api/rust/clinical/actions/${action}`, {
      method: "POST",
      headers: { ...customHeaders, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  const service = await pair("addService", {
    serviceType: "Laboratory",
    label: "  Clinical lab  ",
    dueDate: "2026-09-01",
    note: " Original note ",
  });
  await reject(
    "recordResult",
    {
      serviceRecordId: service.rust.id,
      serviceDate: "2026-09-02",
      results: [
        { labTestId: labs[0].id, value: "9" },
        { labTestId: 2147483647, value: "1" },
      ],
    },
    "NOT_FOUND"
  );
  await assert.rejects(
    () =>
      caller.recordResult({
        patientId: donor.id,
        serviceRecordId: service.rust.id,
        serviceDate: "2026-09-02",
      }),
    error => (error as { code: string }).code === "NOT_FOUND"
  );
  await pair(
    "recordResult",
    {
      serviceDate: "2026-09-02",
      claimDeadline: "2026-10-09",
      nurseApproved: true,
      approvedByNurse: " RN Synthetic ",
      note: " Verified ",
      results: [
        { labTestId: labs[0].id, value: "9" },
        { labTestId: labs[1].id, value: "4" },
      ],
    },
    {
      node: { serviceRecordId: service.node.id },
      rust: { serviceRecordId: service.rust.id },
    }
  );
  await reject(
    "recordResult",
    { serviceRecordId: service.rust.id, serviceDate: "2026-09-02" },
    "CONFLICT"
  );
  await pg`UPDATE ktp."labTests" SET low='1',high='2' WHERE id=${labs[0].id}`;
  await pair(
    "updateService",
    {
      reason: "Typing correction",
      label: "Corrected lab",
      serviceDate: "2026-09-03",
      claimDeadline: "2026-10-10",
      results: [
        { labTestId: labs[0].id, value: "5" },
        { labTestId: labs[1].id, value: "" },
        { labTestId: labs[2].id, value: "7" },
      ],
    },
    { node: { id: service.node.id }, rust: { id: service.rust.id } }
  );
  const [snapshot] =
    await pg`SELECT "lowSnapshot","highSnapshot",flag FROM ktp."labResults" WHERE "serviceRecordId"=${service.rust.id} AND "labTestId"=${labs[0].id}`;
  assert.deepEqual(
    { ...snapshot },
    { lowSnapshot: "3", highSnapshot: "8", flag: "Normal" }
  );
  const [unchanged] =
    await pg`SELECT "updatedAt"::text AS timestamp FROM ktp."serviceRecords" WHERE id=${service.rust.id}`;
  await reject(
    "updateService",
    { id: service.rust.id, reason: "No change" },
    "BAD_REQUEST"
  );
  assert.equal(
    (
      await pg`SELECT "updatedAt"::text AS timestamp FROM ktp."serviceRecords" WHERE id=${service.rust.id}`
    )[0].timestamp,
    unchanged.timestamp
  );
  await reject(
    "updateService",
    { id: service.rust.id, reason: "Bad range", claimDeadline: "2026-09-01" },
    "BAD_REQUEST"
  );
  await reject(
    "updateService",
    {
      id: service.rust.id,
      reason: "Rollback removal",
      results: [
        { labTestId: labs[0].id, value: "" },
        { labTestId: 2147483647, value: "1" },
      ],
    },
    "NOT_FOUND"
  );
  await pair(
    "updateService",
    { reason: "Clear optional fields", claimDeadline: null, note: null },
    { node: { id: service.node.id }, rust: { id: service.rust.id } }
  );
  await pair(
    "fileClaim",
    { claimFiledDate: "2026-09-04" },
    { node: { id: service.node.id }, rust: { id: service.rust.id } }
  );
  await reject(
    "fileClaim",
    { id: service.rust.id, claimFiledDate: "2026-09-04" },
    "CONFLICT"
  );

  const batch = await pair("addLabResults", {
    phase: "Phase1",
    serviceDate: "2026-09-05",
    nurseApproved: true,
    approvedByNurse: "RN Synthetic",
    results: [
      { labTestId: labs[0].id, value: "6" },
      { labTestId: labs[1].id, value: "7" },
    ],
  });
  const third = await pair("addLabResult", {
    phase: "Phase1",
    serviceDate: "2026-09-05",
    labTestId: labs[2].id,
    value: "8",
  });
  assert.equal(batch.rust.serviceRecordId, third.rust.serviceRecordId);
  await reject(
    "addLabResults",
    {
      phase: "Phase1",
      serviceDate: "2026-09-05",
      results: [{ labTestId: labs[0].id, value: "6" }],
    },
    "CONFLICT"
  );
  await reject(
    "addLabResults",
    {
      phase: "Phase2",
      serviceDate: "2026-09-06",
      nurseApproved: true,
      results: [
        { labTestId: labs[0].id, value: "6" },
        { labTestId: 2147483647, value: "1" },
      ],
    },
    "NOT_FOUND"
  );
  await reject(
    "addLabResults",
    {
      phase: "PostDonation",
      serviceDate: "2026-09-06",
      results: [{ labTestId: labs[0].id, value: "6" }],
    },
    "BAD_REQUEST"
  );
  const [item, item2] =
    await pg`SELECT id FROM ktp."checklistCatalog" WHERE active AND "appliesTo" IN ('Both','Recipient') ORDER BY id LIMIT 2`;
  await reject(
    "setChecklistMany",
    {
      items: [
        { catalogId: item.id, status: "Done", doneDate: "2026-09-07" },
        { catalogId: 2147483647, status: "NA" },
      ],
    },
    "NOT_FOUND"
  );
  await pair("setChecklistMany", {
    items: [
      {
        catalogId: item.id,
        status: "Done",
        doneDate: "2026-09-07",
        note: "Verified",
      },
      { catalogId: item2.id, status: "NA" },
    ],
  });
  await pair("setChecklist", { catalogId: item.id, status: "Pending" });
  const appointment = await pair("addAppointment", {
    title: "Synthetic visit",
    kind: "FollowUp",
    startsAt: "2026-10-05T09:00:00+08:00",
    location: " Unit ",
    note: " Visit note ",
  });
  await pair(
    "cancelAppointment",
    {},
    { node: { id: appointment.node.id }, rust: { id: appointment.rust.id } }
  );
  await reject("cancelAppointment", { id: appointment.rust.id }, "CONFLICT");
  await assert.rejects(
    () =>
      caller.cancelAppointment({
        patientId: donor.id,
        id: appointment.rust.id,
      }),
    error => (error as { code: string }).code === "CONFLICT"
  );

  await pair("saveZBenefit", {
    entries: [
      {
        serviceType: "Meds",
        doneDate: "2026-08-01",
        nextDue: "2026-09-01",
        claimDue: "2026-08-20",
      },
      { serviceType: "Tacro", doneDate: "2026-08-02", nextDue: "2026-09-02" },
      { serviceType: "XrayUsd", nextDue: "2026-09-03" },
    ],
  });
  await pair("saveZBenefit", {
    entries: [
      { serviceType: "Meds", doneDate: "2026-07-31", claimFiled: "2026-08-05" },
      {
        serviceType: "Tacro",
        doneDate: "2026-09-02",
        claimDue: "2026-10-01",
        nextDue: "2026-10-02",
      },
      {
        serviceType: "XrayUsd",
        doneDate: "2026-09-03",
        nextDue: "2026-10-03",
        claimDue: "2026-10-04",
      },
    ],
  });
  await pair("saveZBenefit", {
    entries: [
      { serviceType: "XrayUsd", doneDate: "2026-09-02", claimDue: null },
    ],
  });
  await reject(
    "saveZBenefit",
    {
      entries: [
        { serviceType: "Meds", nextDue: "2026-09-02" },
        { serviceType: "Laboratory", claimFiled: "2026-01-01" },
      ],
    },
    "BAD_REQUEST"
  );
  await assert.rejects(
    () =>
      caller.saveZBenefit({
        patientId: donor.id,
        entries: [{ serviceType: "Meds", doneDate: "2026-09-01" }],
      }),
    error => (error as { code: string }).code === "BAD_REQUEST"
  );
  await reject(
    "saveZBenefit",
    { entries: [{ serviceType: "XrayUsd", nextDue: "2026-10-03" }] },
    "BAD_REQUEST"
  );
  assert.deepEqual(
    await caller.listAppointments(),
    await listAllAppointments(),
    "Admin calendar parity"
  );
  assert.deepEqual(
    await caller.zBenefit(),
    await listZBenefit(),
    "Z Benefit list parity"
  );

  // Direct HTTP requests must enforce validation and authentication independently of tRPC.
  for (const [action, fields] of [
    [
      "addService",
      { serviceType: "Meds", label: "Invalid", dueDate: "2026-02-30" },
    ],
    [
      "recordResult",
      { serviceRecordId: service.rust.id, serviceDate: "2999-01-01" },
    ],
    [
      "addLabResults",
      {
        phase: "Phase1",
        serviceDate: "2026-09-10",
        results: [
          { labTestId: labs[0].id, value: "1" },
          { labTestId: labs[0].id, value: "2" },
        ],
      },
    ],
    ["setChecklistMany", { items: [{ catalogId: item.id, status: "Done" }] }],
    [
      "addAppointment",
      { title: "Invalid", kind: "FollowUp", startsAt: "not-a-time" },
    ],
  ] as const)
    assert.equal(
      (await raw(action, { ...fields, patientId: rustPatient.id })).status,
      400,
      action
    );
  assert.equal(
    (
      await raw("addService", {
        patientId: rustPatient.id,
        serviceType: "Meds",
        label: "Invalid",
        dueDate: "2026-09-01",
        actorUserId: 999,
      })
    ).status,
    400
  );
  assert.equal(
    (await raw("addService", { patientId: rustPatient.id }, {})).status,
    401
  );
  const form = await fetch(`${origin}/api/rust/clinical/actions/addService`, {
    method: "POST",
    headers: { ...headers, "content-type": "text/plain" },
    body: "{}",
  });
  assert.equal(form.status, 415);

  // Overlapping bundles share one service; duplicate values are rejected without duplicates.
  await Promise.all(
    [labs[0], labs[1]].map(lab =>
      caller.addLabResults({
        patientId: rustPatient.id,
        phase: "Phase2",
        serviceDate: "2026-09-15",
        results: [{ labTestId: lab.id, value: "5" }],
      })
    )
  );
  const grouped =
    await pg`SELECT id FROM ktp."serviceRecords" WHERE "patientId"=${rustPatient.id} AND phase='Phase2' AND "serviceDate"='2026-09-15'`;
  assert.equal(grouped.length, 1);
  assert.equal(
    (
      await pg`SELECT count(*)::int AS n FROM ktp."labResults" WHERE "serviceRecordId"=${grouped[0].id}`
    )[0].n,
    2
  );
  const duplicate = await Promise.allSettled(
    [1, 2].map(() =>
      caller.addLabResults({
        patientId: rustPatient.id,
        phase: "Phase3",
        serviceDate: "2026-09-16",
        results: [{ labTestId: labs[0].id, value: "5" }],
      })
    )
  );
  assert.equal(duplicate.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(
    (duplicate.find(r => r.status === "rejected") as PromiseRejectedResult)
      .reason.code,
    "CONFLICT"
  );
  const audits =
    await pg`SELECT "actorUserId" FROM ktp."activityLog" WHERE "patientId"=${rustPatient.id}`;
  assert.ok(audits.every(a => a.actorUserId === 1));
  console.log(
    "PASS: every clinical mutation, Node/Rust persisted parity, range snapshots, revisions, rollback, Z Benefit, direct validation and concurrent lab grouping"
  );
}
