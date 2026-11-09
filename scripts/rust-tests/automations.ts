import assert from "node:assert/strict";
import postgres from "postgres";
import { SignJWT } from "jose";
import type { TrpcContext } from "../../server/_core/context";

/** Run only against the disposable parity database and a Rust child started
 * with RESEND_API_KEY="", NODE_ENV="test". No external email deliveries. */
export async function testAutomations(
  pg: ReturnType<typeof postgres>,
  origin: string,
  headers: Record<string, string>
) {
  if (process.env.RESEND_API_KEY || process.env.NODE_ENV === "production") {
    throw new Error("Automation parity tests require mock email configuration");
  }
  const { appRouter } = await import("../../server/routers");
  const caller = appRouter.createCaller({
    user: { id: 1, email: "almanalaysay93@gmail.com", role: "admin" },
    req: { headers, ip: "192.0.2.30" },
    res: {},
  } as unknown as TrpcContext);
  const savedUrl = process.env.RUST_BACKEND_URL!;
  const reference = async <T>(work: () => Promise<T>) => {
    process.env.RUST_BACKEND_URL = "";
    try {
      return await work();
    } finally {
      process.env.RUST_BACKEND_URL = savedUrl;
    }
  };
  const previous =
    await pg`SELECT value FROM ktp."appSettings" WHERE key='email_automation_config'`;
  const cancelled =
    await pg`UPDATE ktp.appointments SET "cancelledAt"=CURRENT_TIMESTAMP WHERE "cancelledAt" IS NULL RETURNING id`;
  const syntheticPatients: number[] = [];
  try {
    const initial = await caller.automations.getConfig();
    assert.deepEqual(
      initial,
      await reference(() => caller.automations.getConfig())
    );
    await pg`INSERT INTO ktp."appSettings" (key,value) VALUES ('email_automation_config','invalid json') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`;
    const defaults = await caller.automations.getConfig();
    assert.deepEqual(
      defaults,
      await reference(() => caller.automations.getConfig())
    );
    assert.equal(defaults.masterEnabled, true);
    assert.equal(defaults.triggers.length, 3);
    const config = {
      masterEnabled: true,
      dispatchTimeManila: "07:30",
      triggers: defaults.triggers.map(trigger => ({
        ...trigger,
        leadDays: trigger.key === "appointment_reminder" ? 3 : trigger.leadDays,
      })),
    };
    assert.deepEqual(await caller.automations.updateConfig(config), {
      success: true,
    });
    assert.deepEqual(
      await caller.automations.getConfig(),
      await reference(() => caller.automations.getConfig())
    );
    await assert.rejects(
      () =>
        caller.automations.updateConfig({
          ...config,
          dispatchTimeManila: "7:30",
        }),
      error => (error as { code: string }).code === "BAD_REQUEST"
    );

    for (const templateName of [
      "AppointmentNotice",
      "OverdueLabAlert",
      "WeeklyClinicalDigest",
      "TestNotice",
    ] as const) {
      for (const sampleData of [
        undefined,
        {},
        {
          patientName: "Synthetic <Patient> & Friends",
          hrn: "AUTOMATION-TEST",
          appointmentDate: "2026-11-09",
          time: "10:30 AM",
          doctorName: "Dr. Synthetic",
          labTitle: "Synthetic lab",
          dueDate: "2026-11-08",
          date: "2026-11-09",
          activeCount: 12,
          pendingLabs: 3,
          upcomingVisits: 4,
          evalCount: 5,
        },
      ]) {
        const actual = await caller.automations.renderPreview({
          templateName,
          sampleData,
        });
        const expected = await reference(() =>
          caller.automations.renderPreview({ templateName, sampleData })
        );
        const stable = (rendered: typeof actual) => ({
          ...rendered,
          html: rendered.html.replace(
            /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,
            "TIMESTAMP"
          ),
        });
        assert.deepEqual(
          stable(actual),
          stable(expected),
          `${templateName} preview parity`
        );
      }
    }
    const test = await caller.automations.sendTestEmail({
      to: "automation@example.invalid",
      templateName: "AppointmentNotice",
    });
    assert.equal(test.status, "mock");
    assert.equal(test.success, true);
    const [delivery] =
      await pg`SELECT status,"templateName","recipientEmail","patientId" FROM ktp."emailLogs" WHERE id=${test.id}`;
    assert.deepEqual(
      { ...delivery },
      {
        status: "mock",
        templateName: "AppointmentNotice",
        recipientEmail: "automation@example.invalid",
        patientId: null,
      }
    );
    const node = await reference(() =>
      caller.automations.sendTestEmail({
        to: "automation-node@example.invalid",
        templateName: "AppointmentNotice",
      })
    );
    assert.equal(node.status, "mock");
    for (const filters of [
      {},
      { status: "mock", limit: 1 },
      { status: "all", offset: 1, limit: 5 },
      { search: "accepted but ignored by source" },
    ]) {
      assert.deepEqual(
        await caller.automations.listLogs(filters),
        await reference(() => caller.automations.listLogs(filters))
      );
    }

    await caller.automations.updateConfig({ ...config, masterEnabled: false });
    const beforeDisabled = await caller.automations.getConfig();
    assert.deepEqual(await caller.automations.runManualSweep(), {
      success: true,
      stats: { created: 0, sent: 0, failed: 0, skipped: 0 },
    });
    assert.deepEqual(await caller.automations.getConfig(), beforeDisabled);
    const patients =
      await pg`INSERT INTO ktp.patients (hrn,"patientType","firstName","lastName",stage,"accountEmail") VALUES
      ('AUTO-MOCK','Recipient','Synthetic','Automation','Phase1','sweep@example.invalid'),
      ('AUTO-SKIP','Recipient','Synthetic','MissingEmail','Phase1',NULL) RETURNING id`;
    syntheticPatients.push(...patients.map(row => row.id));
    for (const patient of patients) {
      await pg`INSERT INTO ktp.appointments ("patientId",title,kind,"startsAt") VALUES (${patient.id},'Synthetic sweep','FollowUp',((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date+1)+time '09:00:00')`;
    }
    await caller.automations.updateConfig(config);
    const first = await caller.automations.runManualSweep();
    assert.deepEqual(first, {
      success: true,
      stats: { created: 1, sent: 1, failed: 0, skipped: 1 },
    });
    const after = await caller.automations.getConfig();
    assert.ok(after.lastRunAt && Number.isFinite(Date.parse(after.lastRunAt)));
    assert.deepEqual(after.lastRunStats, { sent: 1, failed: 0, skipped: 1 });
    assert.deepEqual(await caller.automations.runManualSweep(), {
      success: true,
      stats: { created: 0, sent: 0, failed: 0, skipped: 2 },
    });
    const [count] =
      await pg`SELECT count(*)::int AS n FROM ktp."emailLogs" WHERE "patientId"=${patients[0].id}`;
    assert.equal(
      count.n,
      1,
      "Repeat sweep must not duplicate a mocked delivery"
    );
    await pg.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(5428051821003096393::bigint)`;
      const response = await fetch(
        `${origin}/api/rust/admin/automations/runManualSweep`,
        {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: "{}",
        }
      );
      assert.equal(response.status, 409);
      const updates = await Promise.all(
        [1, 2, 3].map(() =>
          fetch(`${origin}/api/rust/admin/automations/updateConfig`, {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify(config),
          })
        )
      );
      assert.ok(updates.every(result => result.status === 409));
    });

    const [ordinary] =
      await pg`INSERT INTO ktp.users ("openId",email,name) VALUES ('automation-ordinary','automation-user@example.invalid','Synthetic user') RETURNING id,"openId"`;
    const token = await new SignJWT({ openId: ordinary.openId, role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
    for (const operation of [
      "config",
      "logs",
      "preview?templateName=TestNotice",
    ]) {
      assert.equal(
        (await fetch(`${origin}/api/rust/admin/automations/${operation}`))
          .status,
        401
      );
      assert.equal(
        (
          await fetch(`${origin}/api/rust/admin/automations/${operation}`, {
            headers: { cookie: `app_session_id=${token}` },
          })
        ).status,
        403
      );
    }
    const denied = await fetch(
      `${origin}/api/rust/admin/automations/sendTestEmail`,
      {
        method: "POST",
        headers: {
          cookie: `app_session_id=${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          to: "must-not-send@example.invalid",
          templateName: "TestNotice",
        }),
      }
    );
    assert.equal(denied.status, 403);
    console.log(
      "PASS: automation config, template and log parity, mock email, sweep telemetry/dedup, lock contention and role isolation"
    );
  } finally {
    for (const patientId of syntheticPatients) {
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
