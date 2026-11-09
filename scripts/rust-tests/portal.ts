import assert from "node:assert/strict";
import postgres from "postgres";
import { SignJWT } from "jose";
import type { TrpcContext } from "../../server/_core/context";

export async function testPortal(
  pg: ReturnType<typeof postgres>,
  origin: string,
  adminHeaders: Record<string, string>
) {
  const { appRouter } = await import("../../server/routers");
  const { getClinical } = await import("../../server/dbClinical");
  const { listPatientMessages, acknowledgePatientMessage } = await import(
    "../../server/dbMessages"
  );
  const key = new TextEncoder().encode(process.env.JWT_SECRET!);
  const users = await pg`INSERT INTO ktp.users ("openId",name,email,role) VALUES
    ('portal-one','Synthetic One',' PORTAL.ONE@EXAMPLE.INVALID ','user'),
    ('portal-two','Synthetic Two','portal.two@example.invalid','user'),
    ('portal-unknown','Synthetic Unknown','unknown@example.invalid','user'),
    ('portal-duplicate','Synthetic Duplicate','portal.one@example.invalid','user') RETURNING *`;
  const doctors =
    await pg`INSERT INTO ktp.doctors (name,role) VALUES ('Synthetic Doctor','Nephrologist'),('Synthetic Fellow','Fellow') RETURNING *`;
  const [one] =
    await pg`INSERT INTO ktp.patients (hrn,"patientType","firstName","lastName","accountEmail",stage,"nephrologistId","fellowId")
    VALUES ('PORTAL-1','Recipient','Synthetic','One','portal.one@example.invalid','Phase1',${doctors[0].id},${doctors[1].id}) RETURNING *`;
  const [two] =
    await pg`INSERT INTO ktp.patients (hrn,"patientType","firstName","lastName","accountEmail",stage,"linkedRecipientId","consentVersion","linkedUserId")
    VALUES ('PORTAL-2','Donor','Synthetic','Two','portal.two@example.invalid','Phase2',${one.id},2,${users[1].id}) RETURNING *`;
  assert.notEqual(
    users[0].id,
    one.id,
    "Audit tests distinguish user IDs from patient IDs"
  );
  await pg`INSERT INTO ktp."appSettings" (key,value) VALUES ('consentVersion','2'),('consentNoticeText','Synthetic privacy notice') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`;

  const identities = await Promise.all(
    users.map(async user => {
      const token = await new SignJWT({
        openId: user.openId,
        role: "admin",
        patientId: two.id,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("5m")
        .sign(key);
      const headers = {
        cookie: `app_session_id=${token}`,
        "user-agent": "KTP portal fixture",
        "x-ktp-client-ip": "192.0.2.20",
      };
      const context = {
        user,
        req: { headers, ip: "192.0.2.20" },
        res: {},
        patientId: two.id,
      } as unknown as TrpcContext;
      return { user, headers, caller: appRouter.createCaller(context) };
    })
  );
  const [first, second, stranger, duplicate] = identities;
  const direct = async (path: string, identity = first, body?: unknown) =>
    fetch(`${origin}${path}`, {
      headers: {
        ...identity.headers,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      method: body === undefined ? "GET" : "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const forbiddenConsent = async (work: () => Promise<unknown>) =>
    assert.rejects(
      work,
      error =>
        (error as { code: string; message: string }).code === "FORBIDDEN" &&
        (error as Error).message === "CONSENT_REQUIRED"
    );

  assert.equal(await (await fetch(`${origin}/api/rust/auth/me`)).json(), null);
  assert.deepEqual(await first.caller.auth.getConsentNotice(), {
    consentNoticeText: "Synthetic privacy notice",
    consentVersion: 2,
  });
  const me = await first.caller.auth.me();
  assert.equal(me?.id, users[0].id);
  assert.equal(me?.isAdmin, false);
  assert.equal(me?.patient?.id, one.id);
  assert.equal(me?.consentRequired, true);
  assert.ok(me?.createdAt instanceof Date);
  assert.equal(
    (await pg`SELECT "linkedUserId" FROM ktp.patients WHERE id=${one.id}`)[0]
      .linkedUserId,
    users[0].id
  );
  await forbiddenConsent(() => first.caller.patientPortal.getMyProfile());
  const directBlocked = await direct("/api/rust/patient/clinical");
  assert.equal(directBlocked.status, 403);
  assert.deepEqual(await directBlocked.json(), { error: "CONSENT_REQUIRED" });
  assert.equal((await stranger.caller.auth.me())?.patient, null);
  assert.equal(
    (await direct("/api/rust/patient/profile", stranger)).status,
    401
  );
  assert.equal((await duplicate.caller.auth.me())?.patient, null);
  assert.equal(
    (await pg`SELECT "linkedUserId" FROM ktp.patients WHERE id=${one.id}`)[0]
      .linkedUserId,
    users[0].id
  );
  assert.equal((await direct("/api/rust/patients")).status, 403);

  // JSON extraction prevents cross-site form submissions on every mutation.
  for (const path of [
    "/api/rust/patient/consent",
    "/api/rust/patient/contact",
    "/api/rust/patient/messages/1/acknowledge",
    "/api/rust/patient/appointments/1/response",
  ]) {
    const response = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        ...first.headers,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "patientId=1",
    });
    assert.equal(response.status, 415, path);
  }
  assert.equal(
    (await direct("/api/rust/patient/consent", first, { patientId: two.id }))
      .status,
    422
  );
  const accepted = await first.caller.auth.acceptConsent();
  assert.equal(accepted.consentVersion, 2);
  assert.equal(accepted.patient?.id, one.id);
  assert.ok(accepted.patient?.consentAcceptedAt instanceof Date);
  const [consentAudit] =
    await pg`SELECT * FROM ktp."activityLog" WHERE "patientId"=${one.id} AND action='ACCEPT_CONSENT'`;
  assert.equal(consentAudit.actorUserId, users[0].id);
  assert.equal(consentAudit.ipAddress, "192.0.2.20");
  assert.equal(consentAudit.userAgent, "KTP portal fixture");
  assert.deepEqual(JSON.parse(consentAudit.details), { consentVersion: 2 });
  assert.equal((await first.caller.auth.me())?.consentRequired, false);
  await pg`INSERT INTO ktp."appSettings" (key,value) VALUES ('emergencyHotlineText','Synthetic hotline 123'),('internalFixtureSecret','private') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`;
  assert.deepEqual(await first.caller.settings.getPatientSettings(), {
    emergencyHotlineText: "Synthetic hotline 123",
  });
  const profile = await first.caller.patientPortal.getMyProfile();
  assert.equal(profile.patient.id, one.id);
  assert.equal(profile.nephrologist?.name, "Synthetic Doctor");
  assert.ok(profile.nephrologist?.createdAt instanceof Date);
  assert.equal(profile.fellow?.name, "Synthetic Fellow");
  const donorProfile = await second.caller.patientPortal.getMyProfile();
  assert.equal(donorProfile.linkedRecipientName, "Synthetic One");
  assert.equal(JSON.stringify(donorProfile).includes("PORTAL-1"), false);

  await first.caller.patientPortal.updateContact({
    contactNumber: "09170000000",
  });
  assert.equal(
    (await pg`SELECT "contactNumber" FROM ktp.patients WHERE id=${one.id}`)[0]
      .contactNumber,
    "09170000000"
  );
  assert.equal(
    (await pg`SELECT "contactNumber" FROM ktp.patients WHERE id=${two.id}`)[0]
      .contactNumber,
    null
  );
  assert.equal(
    (
      await direct("/api/rust/patient/contact", first, {
        contactNumber: "x".repeat(33),
      })
    ).status,
    400
  );
  assert.equal(
    (await direct("/api/rust/patient/contact", first, {})).status,
    422
  );
  assert.equal(
    (
      await direct("/api/rust/patient/contact", first, {
        patientId: two.id,
        contactNumber: "stolen",
      })
    ).status,
    422
  );
  assert.equal(
    (await first.caller.patientPortal.updateContact({ contactNumber: null }))
      ?.contactNumber,
    null
  );

  const [lab] =
    await pg`SELECT id FROM ktp."labTests" WHERE active ORDER BY id LIMIT 1`;
  const services =
    await pg`INSERT INTO ktp."serviceRecords" ("patientId","serviceType",label,status,"dueDate","serviceDate",phase) VALUES
    (${one.id},'Laboratory','Owned completed','Done','2026-09-02','2026-09-02','Phase1'),
    (${two.id},'Laboratory','Other patient secret','Done','2026-09-02','2026-09-02','Phase2') RETURNING *`;
  await pg`INSERT INTO ktp."labResults" ("serviceRecordId","labTestId",value) VALUES (${services[0].id},${lab.id},'1.2'),(${services[1].id},${lab.id},'private')`;
  const appointments =
    await pg`INSERT INTO ktp.appointments ("patientId",title,kind,"startsAt","cancelledAt") VALUES
    (${one.id},'Owned visit','FollowUp','2026-10-05 01:00:00',NULL),
    (${two.id},'Other visit','FollowUp','2026-10-05 01:00:00',NULL),
    (${one.id},'Cancelled visit','FollowUp','2026-10-06 01:00:00','2026-10-04 01:00:00') RETURNING *`;
  const expectedClinical = await getClinical(one.id);
  const actualClinical = await first.caller.patientPortal.getMyClinical();
  assert.deepEqual(
    actualClinical,
    expectedClinical,
    "Complete Node/Rust clinical read parity"
  );
  assert.equal(
    actualClinical.appointments.find(a => a.id === appointments[0].id)
      ?.startsAt,
    "2026-10-05T01:00:00.000Z"
  );
  assert.ok(actualClinical.services.every(s => s.createdAt instanceof Date));
  assert.ok(actualClinical.services.every(s => s.patientId === one.id));
  assert.ok(actualClinical.labResults.every(r => r.value !== "private"));
  const tampered = await (
    await direct(`/api/rust/patient/clinical?patientId=${two.id}`)
  ).json();
  assert.ok(
    tampered.services.every(
      (s: { patientId: number }) => s.patientId === one.id
    )
  );
  const admin = appRouter.createCaller({
    user: { id: 1, email: "almanalaysay93@gmail.com" },
    req: { headers: adminHeaders },
    res: {},
  } as unknown as TrpcContext);
  assert.deepEqual(
    await admin.clinical.get({ patientId: one.id }),
    expectedClinical
  );
  assert.equal(
    (await direct(`/api/rust/clinical/patients/${two.id}`)).status,
    403
  );

  assert.deepEqual(
    await first.caller.patientPortal.respondAppointment({
      appointmentId: appointments[0].id,
      response: "RescheduleRequested",
      responseNote: " New date please ",
    }),
    { id: appointments[0].id, response: "RescheduleRequested" }
  );
  const [savedAppointment] =
    await pg`SELECT * FROM ktp.appointments WHERE id=${appointments[0].id}`;
  assert.equal(savedAppointment.responseNote, "New date please");
  assert.ok(savedAppointment.respondedAt instanceof Date);
  const [appointmentAudit] =
    await pg`SELECT * FROM ktp."activityLog" WHERE "patientId"=${one.id} AND action='clinical.appointment.respond.RescheduleRequested'`;
  assert.equal(appointmentAudit.actorUserId, users[0].id);
  for (const appointmentId of [
    appointments[1].id,
    appointments[2].id,
    2147483647,
  ]) {
    await assert.rejects(
      () =>
        first.caller.patientPortal.respondAppointment({
          appointmentId,
          response: "Confirmed",
        }),
      error => (error as { code: string }).code === "CONFLICT"
    );
  }

  const messages =
    await pg`INSERT INTO ktp.messages ("senderUserId",subject,body,"targetType") VALUES
    (1,'Owned message','Owned content','Specific'),(1,'Other patient secret','Private message','Specific') RETURNING *`;
  await pg`INSERT INTO ktp."messageRecipients" ("messageId","patientId") VALUES (${messages[0].id},${one.id}),(${messages[1].id},${two.id})`;
  assert.deepEqual(
    await first.caller.patientPortal.getMyMessages(),
    await listPatientMessages(one.id)
  );
  assert.equal(
    (await first.caller.patientPortal.getMyMessages())[0].subject,
    "Owned message"
  );
  await assert.rejects(
    () =>
      first.caller.patientPortal.acknowledgeMessage({
        messageId: messages[1].id,
      }),
    error => (error as { code: string }).code === "NOT_FOUND"
  );
  const acknowledged = await Promise.all(
    Array.from({ length: 4 }, () =>
      first.caller.patientPortal.acknowledgeMessage({
        messageId: messages[0].id,
      })
    )
  );
  assert.ok(acknowledged.every(r => r.success));
  const acknowledgments =
    await pg`SELECT * FROM ktp."messageAcknowledgments" WHERE "patientId"=${one.id}`;
  assert.equal(acknowledgments.length, 1);
  assert.equal(acknowledgments[0].messageId, messages[0].id);
  await acknowledgePatientMessage(one.id, messages[0].id);
  await assert.rejects(
    () => acknowledgePatientMessage(one.id, messages[1].id),
    error => (error as { code: string }).code === "NOT_FOUND"
  );
  assert.equal(
    (
      await pg`SELECT count(*)::int AS n FROM ktp."messageAcknowledgments" WHERE "patientId"=${one.id}`
    )[0].n,
    1
  );
  const afterMessages = await first.caller.patientPortal.getMyMessages();
  assert.equal(typeof afterMessages[0].readAt, "string");
  assert.equal(typeof afterMessages[0].acknowledgedAt, "string");
  const notifications =
    await pg`INSERT INTO ktp.notifications ("patientId",title,message) VALUES (${one.id},'Owned notice','One'),(${two.id},'Other notice','Two') RETURNING id`;
  const notices = await first.caller.notifications.myList();
  assert.ok(
    notices.every(n => n.patientId === one.id && n.createdAt instanceof Date)
  );
  const unread = await first.caller.notifications.myUnreadCount();
  await first.caller.notifications.markMyRead({ id: notifications[1].id });
  assert.equal(
    (
      await pg`SELECT read FROM ktp.notifications WHERE id=${notifications[1].id}`
    )[0].read,
    false
  );
  await first.caller.notifications.markMyRead({ id: notifications[0].id });
  assert.equal(await first.caller.notifications.myUnreadCount(), unread - 1);
  await first.caller.notifications.markAllMyRead();
  assert.equal(await first.caller.notifications.myUnreadCount(), 0);

  await pg`UPDATE ktp."appSettings" SET value='3' WHERE key='consentVersion'`;
  assert.equal((await first.caller.auth.me())?.consentRequired, true);
  await forbiddenConsent(() =>
    first.caller.patientPortal.updateContact({ contactNumber: "blocked" })
  );
  await first.caller.auth.acceptConsent();
  assert.equal((await first.caller.auth.me())?.consentRequired, false);
  await pg`UPDATE ktp.patients SET status='Inactive' WHERE id=${one.id}`;
  assert.equal((await first.caller.auth.me())?.patient, null);
  assert.equal((await direct("/api/rust/patient/profile")).status, 401);
  assert.equal(
    (await direct("/api/rust/patient/consent", first, {})).status,
    401
  );
  await pg`UPDATE ktp.patients SET status='Active' WHERE id=${one.id}`;
  await pg`UPDATE ktp.users SET email='changed@example.invalid' WHERE id=${users[0].id}`;
  const [alternative] =
    await pg`INSERT INTO ktp.patients (hrn,"patientType","firstName","lastName","accountEmail",stage) VALUES ('PORTAL-ALTERNATIVE','Recipient','Synthetic','Alternative','changed@example.invalid','Phase1') RETURNING id`;
  assert.equal((await first.caller.auth.me())?.patient, null);
  assert.equal((await direct("/api/rust/patient/profile")).status, 401);
  assert.equal(
    (
      await pg`SELECT "linkedUserId" FROM ktp.patients WHERE id=${alternative.id}`
    )[0].linkedUserId,
    null
  );
  await pg`UPDATE ktp.users SET email='portal.one@example.invalid' WHERE id=${users[0].id}`;
  await pg`UPDATE ktp."appSettings" SET value='invalid' WHERE key='consentVersion'`;
  assert.equal((await direct("/api/rust/patient/profile")).status, 503);
  await pg`UPDATE ktp."appSettings" SET value='3' WHERE key='consentVersion'`;
  await pg`DELETE FROM ktp.users WHERE id=${users[0].id}`;
  assert.equal(await (await direct("/api/rust/auth/me")).json(), null);
  assert.equal((await direct("/api/rust/patient/profile")).status, 401);
  console.log(
    "PASS: patient linking, consent, ownership, contact, clinical parity, appointment audit, idempotent message acknowledgments, CSRF and access revocation"
  );
}
