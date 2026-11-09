import assert from "node:assert/strict";
import postgres from "postgres";

/** Disposable database only. Rust must be started with RESEND_API_KEY="" and
 * NODE_ENV="test"; all successful deliveries in this test must be mocked. */
export async function testAutomationFailures(
  pg: ReturnType<typeof postgres>,
  origin: string,
  headers: Record<string, string>
) {
  if (process.env.RESEND_API_KEY || process.env.NODE_ENV === "production") {
    throw new Error(
      "Automation failure tests require mock email configuration"
    );
  }
  const previous =
    await pg`SELECT value FROM ktp."appSettings" WHERE key='email_automation_config'`;
  const cancelled =
    await pg`UPDATE ktp.appointments SET "cancelledAt"=CURRENT_TIMESTAMP WHERE "cancelledAt" IS NULL RETURNING id`;
  const patients: number[] = [];
  const sweep = () =>
    fetch(`${origin}/api/rust/admin/automations/runManualSweep`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: "{}",
    });
  const fixture = async (hrn: string, email: string) => {
    const [patient] =
      await pg`INSERT INTO ktp.patients (hrn,"patientType","firstName","lastName",stage,"accountEmail")
        VALUES (${hrn},'Recipient','Synthetic','DeliveryFailure','Phase1',${email}) RETURNING id`;
    patients.push(patient.id);
    const [appointment] =
      await pg`INSERT INTO ktp.appointments ("patientId",title,kind,"startsAt")
        VALUES (${patient.id},'Synthetic failure test','FollowUp',
          ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date+1)+time '09:00:00') RETURNING id`;
    return {
      patientId: patient.id as number,
      appointmentId: appointment.id as number,
    };
  };
  try {
    const config = JSON.stringify({
      masterEnabled: true,
      dispatchTimeManila: "08:00",
      triggers: [
        {
          key: "appointment_reminder",
          label: "Synthetic appointment trigger",
          description: "Mock delivery failure test",
          enabled: true,
          leadDays: 2,
        },
      ],
      lastRunAt: null,
      lastRunStats: null,
    });
    await pg`INSERT INTO ktp."appSettings" (key,value) VALUES ('email_automation_config',${config})
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`;
    const first = await fixture(
      "AUTO-FAIL-INSERT",
      "failure-insert@example.invalid"
    );
    await pg.unsafe(`CREATE FUNCTION ktp.rust_test_email_insert_failure() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NEW."recipientEmail" = 'failure-insert@example.invalid' THEN
          RAISE EXCEPTION 'Synthetic email log insertion rejected';
        END IF;
        RETURN NEW;
      END $$`);
    await pg.unsafe(`CREATE TRIGGER rust_test_email_insert_failure BEFORE INSERT ON ktp."emailLogs"
      FOR EACH ROW EXECUTE FUNCTION ktp.rust_test_email_insert_failure()`);
    const rejected = await sweep();
    assert.equal(rejected.status, 503);
    const rejectedBody = await rejected.json();
    assert.equal(rejectedBody.error, "Database unavailable");
    assert.ok(
      !JSON.stringify(rejectedBody).includes("Synthetic email log insertion")
    );
    const [failedReservation] =
      await pg`SELECT status,"sentAt","errorMessage" FROM ktp."reminderOutbox"
        WHERE "appointmentId"=${first.appointmentId} ORDER BY id DESC LIMIT 1`;
    assert.equal(failedReservation.status, "failed");
    assert.equal(failedReservation.sentAt, null);
    assert.equal(
      failedReservation.errorMessage,
      "Email dispatch could not start"
    );
    const [noLog] =
      await pg`SELECT count(*)::int AS n FROM ktp."emailLogs" WHERE "patientId"=${first.patientId}`;
    assert.equal(noLog.n, 0);

    await pg.unsafe(
      `DROP TRIGGER rust_test_email_insert_failure ON ktp."emailLogs"`
    );
    await pg.unsafe("DROP FUNCTION ktp.rust_test_email_insert_failure()");
    const retried = await sweep();
    assert.equal(retried.status, 200);
    assert.deepEqual(await retried.json(), {
      success: true,
      stats: { created: 1, sent: 1, failed: 0, skipped: 0 },
    });
    const [retryLog] =
      await pg`SELECT status FROM ktp."emailLogs" WHERE "patientId"=${first.patientId}`;
    assert.equal(retryLog.status, "mock");
    const retryReservations =
      await pg`SELECT status FROM ktp."reminderOutbox" WHERE "appointmentId"=${first.appointmentId} ORDER BY id`;
    assert.deepEqual(
      retryReservations.map(row => row.status),
      ["failed", "sent"]
    );

    const second = await fixture(
      "AUTO-FAIL-UPDATE",
      "failure-update@example.invalid"
    );
    await pg.unsafe(`CREATE FUNCTION ktp.rust_test_email_update_failure() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NEW."recipientEmail" = 'failure-update@example.invalid' THEN
          RAISE EXCEPTION 'Synthetic email log update rejected';
        END IF;
        RETURN NEW;
      END $$`);
    await pg.unsafe(`CREATE TRIGGER rust_test_email_update_failure BEFORE UPDATE ON ktp."emailLogs"
      FOR EACH ROW EXECUTE FUNCTION ktp.rust_test_email_update_failure()`);
    const delivered = await sweep();
    assert.equal(delivered.status, 200);
    assert.deepEqual(await delivered.json(), {
      success: true,
      stats: { created: 1, sent: 1, failed: 0, skipped: 1 },
    });
    const [sentReservation] =
      await pg`SELECT status,"sentAt" FROM ktp."reminderOutbox" WHERE "appointmentId"=${second.appointmentId}`;
    assert.equal(sentReservation.status, "sent");
    assert.ok(sentReservation.sentAt);
    const [pendingLog] =
      await pg`SELECT id,status,"errorMessage" FROM ktp."emailLogs" WHERE "patientId"=${second.patientId}`;
    assert.equal(pendingLog.status, "pending");
    assert.equal(
      pendingLog.errorMessage,
      "Delivery started; outcome not yet recorded"
    );
    const logs = await fetch(
      `${origin}/api/rust/admin/automations/logs?status=pending`,
      { headers }
    );
    assert.equal(logs.status, 200);
    const visible = await logs.json();
    assert.ok(
      visible.items.some(
        (row: { id: number; status: string }) =>
          row.id === pendingLog.id && row.status === "pending"
      )
    );
    const repeated = await sweep();
    assert.equal(repeated.status, 200);
    assert.deepEqual(await repeated.json(), {
      success: true,
      stats: { created: 0, sent: 0, failed: 0, skipped: 2 },
    });
    const [logCount] =
      await pg`SELECT count(*)::int AS n FROM ktp."emailLogs" WHERE "patientId"=${second.patientId}`;
    const [outboxCount] =
      await pg`SELECT count(*)::int AS n FROM ktp."reminderOutbox" WHERE "appointmentId"=${second.appointmentId}`;
    assert.equal(
      logCount.n,
      1,
      "Delivery log failure must not cause a second dispatch"
    );
    assert.equal(outboxCount.n, 1);
    console.log(
      "PASS: automation predispatch reservation failure retries safely; postdispatch log failure stays visible without duplicate delivery"
    );
  } finally {
    await pg.unsafe(
      `DROP TRIGGER IF EXISTS rust_test_email_insert_failure ON ktp."emailLogs"`
    );
    await pg.unsafe(
      `DROP TRIGGER IF EXISTS rust_test_email_update_failure ON ktp."emailLogs"`
    );
    await pg.unsafe(
      "DROP FUNCTION IF EXISTS ktp.rust_test_email_insert_failure()"
    );
    await pg.unsafe(
      "DROP FUNCTION IF EXISTS ktp.rust_test_email_update_failure()"
    );
    for (const patientId of patients) {
      await pg`DELETE FROM ktp."reminderOutbox" WHERE "patientId"=${patientId}`;
      await pg`DELETE FROM ktp."emailLogs" WHERE "patientId"=${patientId}`;
      await pg`DELETE FROM ktp.appointments WHERE "patientId"=${patientId}`;
      await pg`DELETE FROM ktp.patients WHERE id=${patientId}`;
    }
    for (const appointment of cancelled)
      await pg`UPDATE ktp.appointments SET "cancelledAt"=NULL WHERE id=${appointment.id}`;
    if (previous.length)
      await pg`UPDATE ktp."appSettings" SET value=${previous[0].value} WHERE key='email_automation_config'`;
    else
      await pg`DELETE FROM ktp."appSettings" WHERE key='email_automation_config'`;
  }
}
