import assert from "node:assert/strict";
import postgres from "postgres";
import { SignJWT } from "jose";
import type { TrpcContext } from "../../server/_core/context";

export async function testAdminWrites(
  pg: ReturnType<typeof postgres>,
  origin: string,
  headers: Record<string, string>
) {
  const { appRouter } = await import("../../server/routers");
  const db = await import("../../server/db");
  const { createBroadcastMessage } = await import("../../server/dbMessages");
  const ctx = {
    user: { id: 1, email: "almanalaysay93@gmail.com", role: "admin" },
    req: { headers, ip: "192.0.2.30" },
    res: {},
  } as unknown as TrpcContext;
  const caller = appRouter.createCaller(ctx);
  const url = process.env.RUST_BACKEND_URL!;
  const reference = async <T>(work: () => Promise<T>) => {
    process.env.RUST_BACKEND_URL = "";
    try {
      return await work();
    } finally {
      process.env.RUST_BACKEND_URL = url;
    }
  };
  const rejected = (work: () => Promise<unknown>, code: string) =>
    assert.rejects(work, e => (e as { code: string }).code === code);
  const canonical = (row: any) => {
    const r = { ...row };
    for (const key of ["id", "createdAt", "updatedAt"]) delete r[key];
    r.hrn = r.hrn.replace(/-(NODE|RUST)$/, "-PAIR");
    if (r.accountEmail)
      r.accountEmail = r.accountEmail.replace(/node|rust/i, "pair");
    if (r.linkedRecipientId) r.linkedRecipientId = "linked";
    return r;
  };
  const base = {
    patientType: "Recipient" as const,
    firstName: " First ",
    lastName: "Synthetic",
    stage: "Phase1",
    birthDate: "1980-02-03",
    middleName: null,
    suffix: "",
    contactNumber: null,
  };
  const node = await reference(() =>
    caller.patients.create({
      ...base,
      hrn: "PWRITE-NODE",
      accountEmail: "PWrite.Node@Example.invalid",
    })
  );
  const rust = await caller.patients.create({
    ...base,
    hrn: "PWRITE-RUST",
    accountEmail: "PWrite.Rust@Example.invalid",
  });
  assert.deepEqual(
    canonical(rust),
    canonical(node),
    "Patient enrollment defaults and null parity"
  );
  assert.ok(rust.birthDate instanceof Date && rust.createdAt instanceof Date);
  const n2 = await reference(() =>
    caller.patients.update({
      id: node.id,
      data: {
        accountEmail: null,
        lastName: "Changed",
        stage: "Phase2",
        followupMonths: 3,
        sex: "M",
      },
    })
  );
  const r2 = await caller.patients.update({
    id: rust.id,
    data: {
      accountEmail: null,
      lastName: "Changed",
      stage: "Phase2",
      followupMonths: 3,
      sex: "M",
    },
  });
  assert.deepEqual(
    canonical(r2),
    canonical(n2),
    "Partial update and explicit-null parity"
  );
  await caller.patients.update({
    id: rust.id,
    data: { accountEmail: "kept@example.invalid" },
  });
  const kept = await caller.patients.update({
    id: rust.id,
    data: { firstName: "Only changed name" },
  });
  assert.equal(kept?.accountEmail, "kept@example.invalid");
  await rejected(
    () => caller.patients.create({ ...base, hrn: rust.hrn }),
    "CONFLICT"
  );
  await rejected(
    () =>
      caller.patients.create({
        ...base,
        hrn: "PWRITE-EMAIL",
        accountEmail: "KEPT@EXAMPLE.INVALID",
      }),
    "CONFLICT"
  );
  await rejected(
    () =>
      caller.patients.create({
        ...base,
        hrn: "PWRITE-ADMIN",
        accountEmail: "share@spmcdvo.net",
      }),
    "BAD_REQUEST"
  );
  await rejected(
    () =>
      caller.patients.create({ ...base, hrn: "PWRITE-POST", stage: "PostKT" }),
    "BAD_REQUEST"
  );
  await rejected(
    () =>
      caller.patients.create({
        ...base,
        hrn: "PWRITE-DONOR-FAIL",
        patientType: "Donor",
      }),
    "BAD_REQUEST"
  );
  const donor = await caller.patients.create({
    ...base,
    patientType: "Donor",
    hrn: "PWRITE-DONOR",
    linkedRecipientId: rust.id,
  });
  await rejected(
    () =>
      caller.patients.update({
        id: donor.id,
        data: { linkedRecipientId: donor.id },
      }),
    "BAD_REQUEST"
  );
  await rejected(
    () =>
      caller.patients.update({ id: donor.id, data: { stage: "PhilHealthZ" } }),
    "BAD_REQUEST"
  );
  await rejected(
    () =>
      caller.patients.update({
        id: donor.id,
        data: { linkedRecipientId: 2147483647 },
      }),
    "BAD_REQUEST"
  );
  const archived = await caller.patients.archive({
    id: rust.id,
    status: "Inactive",
    reason: "Synthetic archive",
  });
  assert.equal(archived?.status, "Inactive");
  await caller.patients.update({ id: rust.id, data: { status: "Active" } });
  const activity = await caller.patients.activityLogs({
    patientId: rust.id,
    limit: 50,
  });
  assert.ok(
    activity.every(r => r.actorUserId === 1 && r.createdAt instanceof Date)
  );
  assert.ok(activity.some(r => r.action === "ENROLL_PATIENT"));
  assert.ok(activity.some(r => r.action === "ARCHIVE_PATIENT"));
  assert.ok(
    activity.some(
      r =>
        r.action === "UPDATE_PATIENT" &&
        JSON.parse(r.details!).toStage === "Phase2"
    )
  );
  assert.deepEqual(activity, await db.listActivityLogs(rust.id, 50));

  const doctor = await caller.doctors.create({
    name: " Synthetic Doctor ",
    role: "Nephrologist",
  });
  assert.equal(doctor.name, " Synthetic Doctor ");
  assert.ok(doctor.active && doctor.createdAt instanceof Date);
  const changed = await caller.doctors.update({
    id: doctor.id,
    active: false,
    role: "Fellow",
  });
  assert.equal(changed?.active, false);
  assert.deepEqual(await caller.doctors.getById({ id: doctor.id }), changed);
  for (const filters of [
    {},
    { activeOnly: false },
    { role: "Fellow" as const, activeOnly: false },
  ])
    assert.deepEqual(
      await caller.doctors.list(filters),
      await db.listDoctors(filters)
    );
  await rejected(() => caller.doctors.getById({ id: 2147483647 }), "NOT_FOUND");
  const previous = await reference(() => caller.settings.getAll());
  assert.deepEqual(await caller.settings.getAll(), previous);
  await caller.settings.update({
    appTitle: " Rust KTP ",
    orgName: "Synthetic Hospital",
    contactEmail: "contact@example.invalid",
    emergencyHotlineText: "Synthetic hotline",
    consentVersion: 4,
  });
  const settings = await caller.settings.getAll();
  assert.equal(settings.appTitle, " Rust KTP ");
  assert.equal(settings.consentVersion, "4");
  assert.deepEqual(settings, await reference(() => caller.settings.getAll()));
  const [settingAudit] =
    await pg`SELECT * FROM ktp."activityLog" WHERE action='UPDATE_SETTINGS' ORDER BY id DESC LIMIT 1`;
  assert.deepEqual(JSON.parse(settingAudit.details).updatedKeys, [
    "emergencyHotlineText",
    "consentVersion",
    "appTitle",
    "orgName",
    "contactEmail",
  ]);
  assert.equal(settingAudit.actorUserId, 1);

  for (const target of [
    { targetType: "All" as const },
    { targetType: "Recipient" as const },
    { targetType: "Donor" as const },
    { targetType: "Stage" as const, targetStage: "Phase1" },
    { targetType: "Specific" as const, targetPatientId: rust.id },
  ]) {
    const expected = await reference(() =>
      caller.messages.create({
        subject: "Node reference",
        body: "Synthetic notice",
        ...target,
      })
    );
    const actual = await caller.messages.create({
      subject: " Rust notice ",
      body: " Synthetic notice ",
      ...target,
    });
    assert.equal(actual.recipientCount, expected.recipientCount);
    const recipients =
      await pg`SELECT "patientId" FROM ktp."messageRecipients" WHERE "messageId"=${actual.id} ORDER BY "patientId"`;
    const expectedRecipients =
      await pg`SELECT "patientId" FROM ktp."messageRecipients" WHERE "messageId"=${expected.id} ORDER BY "patientId"`;
    assert.deepEqual([...recipients], [...expectedRecipients]);
    const [saved] =
      await pg`SELECT subject,body,"senderUserId" FROM ktp.messages WHERE id=${actual.id}`;
    assert.deepEqual(
      { ...saved },
      { subject: "Rust notice", body: "Synthetic notice", senderUserId: 1 }
    );
  }
  assert.deepEqual(
    await caller.messages.list(),
    await (await import("../../server/dbMessages")).listAdminMessages()
  );
  for (const targetType of ["Stage", "Specific"] as const) {
    await rejected(
      () =>
        caller.messages.create({
          subject: "No scope",
          body: "Must not send",
          targetType,
        }),
      "BAD_REQUEST"
    );
    await rejected(
      () =>
        createBroadcastMessage({
          senderUserId: 1,
          subject: "No scope",
          body: "Must not send",
          targetType,
        }),
      "BAD_REQUEST"
    );
    const response = await fetch(`${origin}/api/rust/admin/messages`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        subject: "No scope",
        body: "Must not send",
        targetType,
      }),
    });
    assert.equal(response.status, 400);
  }
  const [user] =
    await pg`INSERT INTO ktp.users ("openId",email,name) VALUES ('admin-test-user','ordinary@example.invalid','Synthetic session') RETURNING *`;
  const token = await new SignJWT({ openId: user.openId, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
  const patientHeaders = { cookie: `app_session_id=${token}` };
  assert.equal(
    (await fetch(`${origin}/api/rust/doctors`, { headers: patientHeaders }))
      .status,
    200
  );
  assert.equal(
    (
      await fetch(`${origin}/api/rust/admin/entities/settings`, {
        headers: patientHeaders,
      })
    ).status,
    403
  );
  assert.equal(
    (
      await fetch(`${origin}/api/rust/admin/messages`, {
        headers: patientHeaders,
      })
    ).status,
    403
  );
  const before = await pg`SELECT count(*)::int AS n FROM ktp.patients`;
  const invalid = await fetch(`${origin}/api/rust/admin/patients/create`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ ...base, hrn: "PWRITE-UNSAFE", consentVersion: 4 }),
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(
    [...(await pg`SELECT count(*)::int AS n FROM ktp.patients`)],
    [...before]
  );
  assert.equal(
    (
      await fetch(`${origin}/api/rust/admin/patients/create`, {
        method: "POST",
        headers: { ...patientHeaders, "content-type": "application/json" },
        body: JSON.stringify({ ...base, hrn: "PWRITE-DENIED" }),
      })
    ).status,
    403
  );
  console.log(
    "PASS: enrollment/edit/archive, donor links, dates, audits, doctors, settings, scoped broadcasts, notifications and role isolation"
  );
}
