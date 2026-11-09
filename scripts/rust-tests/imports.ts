import assert from "node:assert/strict";
import postgres from "postgres";
import { SignJWT } from "jose";
import { addDays, todayDate } from "../../shared/ktp";
import type { ImportRow } from "../../server/dbPatientImport";
import type { TrpcContext } from "../../server/_core/context";

export async function testPatientImports(
  pg: ReturnType<typeof postgres>,
  origin: string,
  headers: Record<string, string>
) {
  const { patientImportRouter } = await import(
    "../../server/routers/patientImport"
  );
  const { checkImportRows, commitImportRows } = await import(
    "../../server/dbPatientImport"
  );
  const caller = patientImportRouter.createCaller({
    user: { id: 1, email: "almanalaysay93@gmail.com", role: "admin" },
    req: { headers, ip: "192.0.2.40" },
    res: {},
  } as unknown as TrpcContext);
  const row = (hrn: string): ImportRow => ({
    hrn,
    patientType: "Recipient",
    firstName: " Synthetic ",
    lastName: "Import",
  });
  const post = (operation: string, body: unknown, auth = headers) =>
    fetch(`${origin}/api/rust/admin/patient-import/${operation}`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const rejected = (work: () => Promise<unknown>, code: string) =>
    assert.rejects(work, error => (error as { code: string }).code === code);
  const parity = async (rows: ImportRow[], label: string) => {
    const expected = await checkImportRows(rows);
    const actual = await caller.check({ rows });
    assert.deepEqual(actual, expected, label);
    return actual;
  };

  const [doctor] = await pg`INSERT INTO ktp.doctors (name,role,active)
    VALUES ('Dr. Import Parity, MD','Nephrologist',true) RETURNING id`;
  const [fellow] = await pg`INSERT INTO ktp.doctors (name,role,active)
    VALUES ('Dr. Import Fellow','Fellow',true) RETURNING id`;
  await pg`INSERT INTO ktp.doctors (name,role,active)
    VALUES ('Dr. Import Inactive','Nephrologist',false)`;
  await pg`INSERT INTO ktp.patients (hrn,"patientType","firstName","lastName",stage,"accountEmail") VALUES
    ('IMPAR-SAVED','Recipient','Synthetic','Saved','Orientation','impar.saved@example.invalid'),
    (' IMPAR-SPACED ','Recipient','Synthetic','Spaced','Orientation',NULL)`;

  const checked = await parity(
    [
      {
        hrn: "",
        patientType: "Patient",
        firstName: "",
        lastName: "X",
        accountEmail: "not-email",
        stage: "PostKT",
        birthDate: "2999-01-01",
        sex: "X",
        followupMonths: 7,
      },
      {
        ...row("IMPAR-DEFAULT"),
        nephrologist: "Dr. Nobody",
        fellow: "Dr. Import Inactive",
      },
      { ...row("IMPAR-DUP"), accountEmail: "Repeat@example.invalid" },
      { ...row("impar-dup"), accountEmail: "REPEAT@EXAMPLE.INVALID" },
      { ...row("impar-saved"), accountEmail: "IMPAR.SAVED@EXAMPLE.INVALID" },
      { ...row("IMPAR-ADMIN"), accountEmail: " Share@SPMCDVO.NET " },
      {
        ...row("IMPAR-LIMIT"),
        firstName: "x".repeat(129),
        middleName: "x".repeat(129),
        lastName: "x".repeat(129),
        suffix: "x".repeat(33),
        contactNumber: "x".repeat(33),
        sex: "bad",
        birthDate: "2026-02-30",
        surgeryDate: "not-a-date",
        riskCategory: "bad",
        status: "bad",
        followupMonths: "1.5",
      },
      {
        ...row("IMPAR-WRONG-LINK"),
        patientType: "Donor",
        stage: "PhilHealthZ",
        linkedRecipientHrn: "not-present",
      },
      {
        ...row("IMPAR-SELF"),
        patientType: "Donor",
        linkedRecipientHrn: "impar-self",
      },
      { ...row("IMPAR-NO-LINK"), patientType: "Donor" },
      { ...row("IMPAR-MISSING-SURGERY"), stage: "PostKT" },
      {
        ...row("IMPAR-DOCTORS"),
        nephrologist: "IMPORT PARITY",
        fellow: "DR. IMPORT FELLOW, MD",
        sex: "f",
        followupMonths: "0x2",
      },
      {
        ...row("IMPAR-FUTURE-SURGERY"),
        stage: "PostKT",
        surgeryDate: addDays(todayDate(), 1),
      },
      // Import's intentionally permissive e-mail rule differs from enrollment's.
      { ...row("IMPAR-EMAIL-DOTS"), accountEmail: "a@b.c.d" },
    ],
    "Import validation errors, warnings, defaults and order match Node"
  );
  assert.deepEqual(checked[0].errors, [
    "HRN is missing.",
    "Type must be Recipient or Donor.",
    "First name is missing.",
    "Email address is not a valid e-mail address.",
    "Sex must be M or F.",
    "Birth date is in the future.",
    "Surgery date is necessary for stage PostKT.",
    "Follow-up interval must be 1, 2, or 3 months.",
  ]);
  assert.deepEqual(checked[1].warnings, [
    "No email contact provided.",
    "No stage. Orientation is used.",
    'Nephrologist "Dr. Nobody" is not in the doctor list. The field stays empty.',
    'Fellow "Dr. Import Inactive" is not in the doctor list. The field stays empty.',
  ]);
  assert.deepEqual(checked[11].errors, []);
  assert.deepEqual(checked[13].errors, []);

  const whitespace = await parity(
    [
      row("IMPAR-SPACED"),
      {
        ...row("IMPAR-SPACED-DONOR"),
        patientType: "Donor",
        linkedRecipientHrn: "IMPAR-SPACED",
      },
    ],
    "Stored HRNs retain whitespace in duplicate detection and donor lookup"
  );
  // In-file Recipient intentionally allows this donor; the stored padded HRN
  // alone must not satisfy the same lookup.
  assert.deepEqual(whitespace[0].errors, []);
  const [missingLink] = await parity(
    [
      {
        ...row("IMPAR-SPACED-DONOR"),
        patientType: "Donor",
        linkedRecipientHrn: "IMPAR-SPACED",
      },
    ],
    "Stored padded HRN cannot satisfy an unpadded donor link"
  );
  assert.deepEqual(missingLink.errors, [
    "Linked recipient HRN IMPAR-SPACED is not a recipient in the registry or in this list.",
  ]);

  const batch = (side: string): ImportRow[] => [
    {
      ...row(`IMPAR-D-${side}`),
      patientType: "Donor",
      linkedRecipientHrn: `impar-r-${side.toLowerCase()}`,
      riskCategory: "High",
      stage: "Phase2",
    },
    {
      ...row(`IMPAR-R-${side}`),
      firstName: " Trimmed ",
      middleName: "",
      accountEmail: ` Import.${side}@Example.invalid `,
      stage: "PostKT",
      surgeryDate: "2026-01-02",
      birthDate: "1980-02-03",
      sex: "f",
      riskCategory: "High",
      followupMonths: "2",
      nephrologist: "DR. IMPORT PARITY, MD",
      fellow: "IMPORT FELLOW",
    },
    { ...row(`IMPAR-NOEMAIL-${side}`), accountEmail: null },
    {
      ...row(`IMPAR-EXISTING-D-${side}`),
      patientType: "Donor",
      linkedRecipientHrn: "impar-saved",
      followupMonths: 3,
    },
  ];
  const nodeRows = batch("NODE"),
    rustRows = batch("RUST");
  await parity(
    rustRows,
    "In-file recipient links validate before their recipient is saved"
  );
  const expected = await commitImportRows(nodeRows, 1, "patients.xlsx");
  const actual = await caller.commit({
    rows: rustRows,
    fileName: " patients.xlsx ",
  });
  assert.equal(actual.count, expected.count);
  assert.equal(actual.count, 4);
  const normalize = (value: unknown) =>
    typeof value === "string"
      ? value.replace(/NODE|RUST/g, "PAIR").replace(/node|rust/g, "pair")
      : value;
  const projection = async (ids: number[]) => {
    const saved =
      await pg`SELECT to_jsonb(p)-'id'-'createdAt'-'updatedAt'-'linkedRecipientId'
      || jsonb_build_object('linkedRecipientHrn',r.hrn) AS row
      FROM ktp.patients p LEFT JOIN ktp.patients r ON r.id=p."linkedRecipientId"
      WHERE p.id IN ${pg(ids)} ORDER BY p.id`;
    return saved.map(({ row }) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, normalize(value)])
      )
    );
  };
  assert.deepEqual(
    await projection(actual.ids),
    await projection(expected.ids),
    "Imported persisted fields, defaults, dates, doctors and donor links match Node"
  );
  const saved =
    await pg`SELECT * FROM ktp.patients WHERE id IN ${pg(actual.ids)} ORDER BY id`;
  assert.deepEqual(
    saved.map(p => p.patientType),
    ["Recipient", "Recipient", "Donor", "Donor"]
  );
  assert.deepEqual(
    saved.map(p => p.id),
    actual.ids,
    "Response IDs preserve recipient-first save order"
  );
  assert.equal(saved[0].nephrologistId, doctor.id);
  assert.equal(saved[0].fellowId, fellow.id);
  assert.equal(saved[0].firstName, "Trimmed");
  assert.equal(saved[0].accountEmail, "import.rust@example.invalid");
  assert.equal(saved[1].accountEmail, null);
  assert.equal(saved[2].riskCategory, null);
  assert.equal(saved[2].linkedRecipientId, saved[0].id);
  const audits = async (ids: number[]) => {
    const events =
      await pg`SELECT "actorUserId","patientId",action,details,"ipAddress","userAgent"
      FROM ktp."activityLog" WHERE "patientId" IN ${pg(ids)} AND action='IMPORT_PATIENT' ORDER BY id`;
    assert.deepEqual(
      events.map(event => event.patientId),
      ids
    );
    return events.map(event => ({
      ...event,
      patientId: "patient",
      details: Object.fromEntries(
        Object.entries(JSON.parse(event.details)).map(([key, value]) => [
          key,
          normalize(value),
        ])
      ),
    }));
  };
  assert.deepEqual(
    await audits(actual.ids),
    await audits(expected.ids),
    "Each imported patient has the same transactional audit"
  );
  await parity(
    rustRows,
    "Imported HRNs and normalized Gmail addresses become saved duplicates"
  );

  const counts = async () => ({
    patients: (await pg`SELECT count(*)::int AS n FROM ktp.patients`)[0].n,
    audits: (
      await pg`SELECT count(*)::int AS n FROM ktp."activityLog" WHERE action='IMPORT_PATIENT'`
    )[0].n,
  });
  const before = await counts();
  await rejected(
    () =>
      commitImportRows(
        [
          row("IMPAR-ROLLBACK-NODE"),
          { ...row("IMPAR-BAD-NODE"), lastName: "" },
        ],
        1,
        "bad.xlsx"
      ),
    "BAD_REQUEST"
  );
  await rejected(
    () =>
      caller.commit({
        rows: [
          row("IMPAR-ROLLBACK-RUST"),
          { ...row("IMPAR-BAD-RUST"), lastName: "" },
        ],
        fileName: "bad.xlsx",
      }),
    "BAD_REQUEST"
  );
  assert.deepEqual(
    await counts(),
    before,
    "Invalid batches save neither patients nor audit events"
  );

  // Two overlapping imports must revalidate after the registry lock releases.
  const overlap = { rows: [row("IMPAR-CONCURRENT")], fileName: "overlap.xlsx" };
  const concurrent = await Promise.allSettled([
    caller.commit(overlap),
    caller.commit(overlap),
  ]);
  assert.equal(
    concurrent.filter(result => result.status === "fulfilled").length,
    1
  );
  const failure = concurrent.find(result => result.status === "rejected");
  assert.ok(failure?.status === "rejected");
  assert.equal(failure.reason.code, "BAD_REQUEST");
  assert.equal(
    (await pg`SELECT id FROM ktp.patients WHERE hrn='IMPAR-CONCURRENT'`).length,
    1
  );
  assert.equal(
    (
      await pg`SELECT id FROM ktp."activityLog" WHERE action='IMPORT_PATIENT' AND details::jsonb->>'hrn'='IMPAR-CONCURRENT'`
    ).length,
    1
  );

  for (const payload of [
    { rows: [] },
    { rows: Array.from({ length: 201 }, () => row("IMPAR-TOO-MANY")) },
    { rows: [{ ...row("IMPAR-TOO-LONG"), firstName: "x".repeat(401) }] },
    {
      rows: [{ ...row("IMPAR-FOLLOWUP-LONG"), followupMonths: "12345678901" }],
    },
    { rows: [{ ...row("IMPAR-UNSAFE"), linkedUserId: 1 }] },
  ])
    assert.equal((await post("check", payload)).status, 400);
  assert.equal(
    (
      await post("commit", {
        rows: [row("IMPAR-FILE-LONG")],
        fileName: "x".repeat(256),
      })
    ).status,
    400
  );
  assert.equal(
    (await post("commit", { rows: [row("IMPAR-ANON")] }, {})).status,
    401
  );
  const [ordinary] =
    await pg`INSERT INTO ktp.users ("openId",email) VALUES ('import-parity-user','import.user@example.invalid') RETURNING "openId"`;
  const token = await new SignJWT({ openId: ordinary.openId, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
  assert.equal(
    (
      await post(
        "commit",
        { rows: [row("IMPAR-DENIED")] },
        { cookie: `app_session_id=${token}` }
      )
    ).status,
    403
  );
  console.log(
    "PASS: PostgreSQL import validation parity, stored HRN whitespace, defaults, doctor matching, donor links, audit parity, rollback and concurrent duplicate prevention"
  );
}
