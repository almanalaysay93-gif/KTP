import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { getSqliteDb } from "./localDb";

describe("messages and appointment responses", () => {
  const db = getSqliteDb();

  beforeEach(() => {
    db.exec(`
      DELETE FROM messageAcknowledgments;
      DELETE FROM messageRecipients;
      DELETE FROM messages;
      DELETE FROM appointments;
      DELETE FROM patients;
      DELETE FROM users;
      DELETE FROM activityLog;
    `);

    // Seed admin user
    db.prepare(`
      INSERT INTO users (id, openId, name, email, role)
      VALUES (1, 'admin-open-id', 'Admin User', 'share@spmcdvo.net', 'admin')
    `).run();

    // Seed test patients
    db.prepare(`
      INSERT INTO patients (id, hrn, patientType, firstName, lastName, accountEmail, stage, status, consentVersion)
      VALUES
        (10, 'REC-001', 'Recipient', 'Juan', 'Dela Cruz', 'juan@gmail.com', 'Orientation', 'Active', 1),
        (11, 'REC-002', 'Recipient', 'Maria', 'Clara', 'maria@gmail.com', 'PostKT', 'Active', 1),
        (12, 'DON-001', 'Donor', 'Pedro', 'Santos', 'pedro@gmail.com', 'Orientation', 'Active', 1)
    `).run();
  });

  const adminCaller = appRouter.createCaller({
    user: { id: 1, email: "share@spmcdvo.net", name: "Admin", role: "admin", openId: "admin-open-id", loginMethod: "test", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { ip: "127.0.0.1", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  });

  const patientCaller = (patientId: number, email = "juan@gmail.com") =>
    appRouter.createCaller({
      user: { id: 100 + patientId, email, name: "Patient", role: "user", openId: `patient-${patientId}`, loginMethod: "test", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: { ip: "127.0.0.1", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

  it("broadcasts messages to target groups and tracks patient acknowledgment", async () => {
    // 1. Broadcast to all active patients
    const res = await adminCaller.messages.create({
      subject: "Unit Clinic Advisory",
      body: "Clinic will close at 3 PM this Friday for sanitization.",
      targetType: "All",
    });
    expect(res.recipientCount).toBe(3);

    // 2. Admin lists messages
    const adminList = await adminCaller.messages.list();
    expect(adminList.length).toBe(1);
    expect(adminList[0].subject).toBe("Unit Clinic Advisory");
    expect(adminList[0].recipientCount).toBe(3);
    expect(adminList[0].acknowledgedCount).toBe(0);

    // 3. Patient reads and acknowledges
    const p10 = patientCaller(10);
    const pMessages = await p10.patientPortal.getMyMessages();
    expect(pMessages.length).toBe(1);
    expect(pMessages[0].acknowledgedAt).toBeNull();

    await p10.patientPortal.acknowledgeMessage({ messageId: pMessages[0].id });

    // 4. Verify acknowledgment recorded
    const pMessagesAfter = await p10.patientPortal.getMyMessages();
    expect(pMessagesAfter[0].acknowledgedAt).toBeTruthy();

    const adminListAfter = await adminCaller.messages.list();
    expect(adminListAfter[0].acknowledgedCount).toBe(1);
  });

  it("records patient appointment confirmation and reschedule requests", async () => {
    // 1. Admin adds appointment
    const appt = await adminCaller.clinical.addAppointment({
      patientId: 10,
      title: "Routine Graft Check",
      kind: "FollowUp",
      startsAt: "2026-10-15T09:00:00+08:00",
      location: "Room 302",
    });

    const p10 = patientCaller(10);
    const clinicalData = await p10.patientPortal.getMyClinical();
    expect(clinicalData.appointments.length).toBe(1);
    expect(clinicalData.appointments[0].response).toBe("Pending");

    // 2. Patient confirms
    await p10.patientPortal.respondAppointment({
      appointmentId: appt.id,
      response: "Confirmed",
    });

    const updated = await p10.patientPortal.getMyClinical();
    expect(updated.appointments[0].response).toBe("Confirmed");

    // 3. Patient requests reschedule
    await p10.patientPortal.respondAppointment({
      appointmentId: appt.id,
      response: "RescheduleRequested",
      responseNote: "Please move to afternoon",
    });

    const rescheduled = await p10.patientPortal.getMyClinical();
    expect(rescheduled.appointments[0].response).toBe("RescheduleRequested");
    expect(rescheduled.appointments[0].responseNote).toBe("Please move to afternoon");
  });
});
