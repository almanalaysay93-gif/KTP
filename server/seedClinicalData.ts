import type postgres from "postgres";
import type Database from "better-sqlite3";

/*
 * Seed clinical data for all 7 patients (Orientation, Phase 1, Phase 2, Clearances, PhilHealth Z, Phase 3, Post-KT).
 * Populates serviceRecords, labResults, patientChecklist, appointments, notifications, and messages.
 */

interface ClinicalPatientSeed {
  hrn: string;
  services: {
    serviceType: "Meds" | "Laboratory" | "Tacro" | "XrayUsd";
    label: string;
    status: "Planned" | "Done";
    dueDate: string;
    serviceDate?: string;
    claimDeadline?: string;
    claimFiledDate?: string;
    phase?: "Phase1" | "Phase2" | "Phase3" | "PostKT";
    labs?: { testName: string; value: string; flag?: "Low" | "Normal" | "High" }[];
  }[];
  checklistDone: string[];
  appointments: {
    title: string;
    kind: "FollowUp" | "Biopsy" | "Workup" | "Clearance";
    startsAt: string;
    location: string;
    response?: "Pending" | "Confirmed" | "RescheduleRequested";
  }[];
  notifications: {
    title: string;
    message: string;
    type: "info" | "warning" | "urgent";
  }[];
}

export const CLINICAL_SEEDS: readonly ClinicalPatientSeed[] = [
  {
    hrn: "KTP-2026-0001", // Post-KT
    services: [
      { serviceType: "Meds", label: "Post-KT Month 6 Meds", status: "Done", dueDate: "2026-07-15", serviceDate: "2026-07-15", claimDeadline: "2026-08-15", claimFiledDate: "2026-07-20" },
      { serviceType: "Meds", label: "Post-KT Month 7 Meds", status: "Done", dueDate: "2026-08-15", serviceDate: "2026-08-15", claimDeadline: "2026-09-15", claimFiledDate: "2026-08-25" },
      { serviceType: "Meds", label: "Post-KT Month 8 Meds", status: "Done", dueDate: "2026-09-15", serviceDate: "2026-09-15", claimDeadline: "2026-10-15" },
      { serviceType: "Meds", label: "Post-KT Month 9 Meds", status: "Planned", dueDate: "2026-10-15" },
      {
        serviceType: "Laboratory", label: "Post-KT Routine Labs", status: "Done", dueDate: "2026-09-15", serviceDate: "2026-09-15", claimDeadline: "2026-10-15",
        labs: [
          { testName: "Creatinine", value: "110", flag: "Normal" },
          { testName: "BUN", value: "6.2", flag: "Normal" },
          { testName: "Tacrolimus trough", value: "6.8", flag: "Normal" },
          { testName: "Potassium", value: "4.2", flag: "Normal" },
          { testName: "Hemoglobin", value: "128", flag: "Normal" },
        ],
      },
      { serviceType: "Laboratory", label: "Post-KT Month 9 Labs", status: "Planned", dueDate: "2026-10-15" },
      { serviceType: "Tacro", label: "Tacrolimus Level Check", status: "Done", dueDate: "2026-09-15", serviceDate: "2026-09-15", claimDeadline: "2026-10-15" },
      { serviceType: "Tacro", label: "Tacrolimus Monitoring", status: "Planned", dueDate: "2026-10-15" },
      { serviceType: "XrayUsd", label: "Graft Kidney Doppler Ultrasound", status: "Done", dueDate: "2026-07-15", serviceDate: "2026-07-15", claimDeadline: "2026-08-15", claimFiledDate: "2026-07-25" },
      { serviceType: "XrayUsd", label: "Graft Ultrasound Follow-up", status: "Planned", dueDate: "2026-11-15" },
    ],
    checklistDone: [
      "Pre-transplant orientation", "Initial nephrology assessment", "HTEC evaluation and approval",
      "CDTE and risk stratification", "PhilHealth Z Package qualification and application",
    ],
    appointments: [
      { title: "Routine Post-KT Monthly Follow-up", kind: "FollowUp", startsAt: "2026-10-15T09:00:00+08:00", location: "Kidney Transplant Clinic, Room 302", response: "Confirmed" },
    ],
    notifications: [
      { title: "Tacrolimus in Target Range", message: "Your recent Tacrolimus level (6.8 ng/mL) is within target range. Maintain current immunosuppressant dosage.", type: "info" },
    ],
  },
  {
    hrn: "KTP-2026-0002", // Phase 1
    services: [
      {
        serviceType: "Laboratory", label: "Phase 1 Blood Chemistry", status: "Done", dueDate: "2026-09-28", serviceDate: "2026-09-28", phase: "Phase1",
        labs: [
          { testName: "Creatinine", value: "320", flag: "High" },
          { testName: "BUN", value: "18.5", flag: "High" },
          { testName: "Hemoglobin", value: "105", flag: "Low" },
          { testName: "Potassium", value: "4.8", flag: "Normal" },
        ],
      },
      { serviceType: "Laboratory", label: "Phase 1 Virological Panel", status: "Planned", dueDate: "2026-10-12", phase: "Phase1" },
    ],
    checklistDone: [
      "Pre-transplant orientation", "Initial nephrology assessment", "Blood typing ABO and Rh", "Chest X-ray PA", "12-lead ECG",
    ],
    appointments: [
      { title: "Nephrology Workup Consultation", kind: "Workup", startsAt: "2026-10-10T10:30:00+08:00", location: "OPD Nephrology Desk 4", response: "Confirmed" },
    ],
    notifications: [
      { title: "Phase 1 Labs Recorded", message: "Initial blood chemistry results recorded. Nephrology consultation scheduled for October 10.", type: "info" },
    ],
  },
  {
    hrn: "KTP-2026-0003", // Phase 2
    services: [
      {
        serviceType: "Laboratory", label: "Immunology & HLA Panel", status: "Done", dueDate: "2026-09-15", serviceDate: "2026-09-15", phase: "Phase2",
        labs: [
          { testName: "Creatinine", value: "285", flag: "High" },
          { testName: "BUN", value: "16.0", flag: "High" },
          { testName: "Hemoglobin", value: "110", flag: "Low" },
        ],
      },
      { serviceType: "Laboratory", label: "Crossmatch & Flow Cytometry", status: "Planned", dueDate: "2026-10-15", phase: "Phase2" },
    ],
    checklistDone: [
      "Pre-transplant orientation", "Initial nephrology assessment", "Blood typing ABO and Rh", "Chest X-ray PA",
      "Whole abdomen ultrasound", "2D echo with Doppler", "HLA typing class I and II", "PRA screening class I, II, MICA",
    ],
    appointments: [
      { title: "HLA Typing & Immunology Review", kind: "Workup", startsAt: "2026-10-14T14:00:00+08:00", location: "Transplant Coordinator Office", response: "Confirmed" },
    ],
    notifications: [
      { title: "HLA Typing Verified", message: "Class I and Class II HLA typing completed. Awaiting prospective donor crossmatch.", type: "info" },
    ],
  },
  {
    hrn: "KTP-2026-0004", // Clearances
    services: [
      {
        serviceType: "Laboratory", label: "Clearance Baseline Labs", status: "Done", dueDate: "2026-09-10", serviceDate: "2026-09-10",
        labs: [
          { testName: "Creatinine", value: "240", flag: "High" },
          { testName: "Potassium", value: "4.5", flag: "Normal" },
        ],
      },
      { serviceType: "XrayUsd", label: "Pre-Clearance Ultrasound", status: "Planned", dueDate: "2026-10-05" },
    ],
    checklistDone: [
      "Pre-transplant orientation", "Initial nephrology assessment", "Dental clearance", "Cardiology clearance",
      "Psychosocial evaluation", "Ethics committee",
    ],
    appointments: [
      { title: "Pulmonary Clearance Visit", kind: "Clearance", startsAt: "2026-10-06T11:00:00+08:00", location: "Pulmonary Clinic, 2nd Floor", response: "Pending" },
    ],
    notifications: [
      { title: "Cardiology Clearance Approved", message: "Cardiology has cleared you for transplantation. Please attend upcoming pulmonary clearance.", type: "info" },
    ],
  },
  {
    hrn: "KTP-2026-0005", // PhilHealth Z
    services: [
      { serviceType: "Meds", label: "PhilHealth Z Pre-Transplant Meds", status: "Planned", dueDate: "2026-10-03" },
      {
        serviceType: "Laboratory", label: "PhilHealth Z Qualifying Labs", status: "Done", dueDate: "2026-09-20", serviceDate: "2026-09-20", claimDeadline: "2026-10-20",
        labs: [
          { testName: "Creatinine", value: "410", flag: "High" },
          { testName: "BUN", value: "22.4", flag: "High" },
          { testName: "Hemoglobin", value: "98", flag: "Low" },
        ],
      },
      { serviceType: "Tacro", label: "Pre-transplant Baseline Tacro", status: "Planned", dueDate: "2026-10-18" },
    ],
    checklistDone: [
      "Pre-transplant orientation", "Initial nephrology assessment", "CDTE and risk stratification",
      "PhilHealth Z Package qualification and application", "HTEC evaluation and approval",
    ],
    appointments: [
      { title: "PhilHealth Z Claims Evaluation", kind: "Workup", startsAt: "2026-10-04T13:30:00+08:00", location: "Billing & Claims Office", response: "Confirmed" },
    ],
    notifications: [
      { title: "Z Package Application Submitted", message: "Your PhilHealth Z Package documents have been submitted to claims.", type: "info" },
    ],
  },
  {
    hrn: "KTP-2026-0006", // Phase 3
    services: [
      {
        serviceType: "Laboratory", label: "Final Pre-Transplant Labs", status: "Done", dueDate: "2026-09-25", serviceDate: "2026-09-25", phase: "Phase3",
        labs: [
          { testName: "Hemoglobin", value: "112", flag: "Low" },
          { testName: "WBC", value: "6.2", flag: "Normal" },
          { testName: "Platelets", value: "210", flag: "Normal" },
          { testName: "Creatinine", value: "315", flag: "High" },
        ],
      },
      { serviceType: "Laboratory", label: "Final 48-Hour Pre-Op Chemistry", status: "Planned", dueDate: "2026-10-01", phase: "Phase3" },
      { serviceType: "Tacro", label: "Induction Protocol Lab", status: "Planned", dueDate: "2026-10-08" },
    ],
    checklistDone: [
      "Pre-transplant orientation", "Initial nephrology assessment", "Repeat chest X-ray",
      "Repeat CBC", "Final crossmatch (T and B cell)", "HTEC evaluation and approval",
    ],
    appointments: [
      { title: "Pre-Operative Briefing", kind: "Workup", startsAt: "2026-10-07T08:30:00+08:00", location: "Surgical Conference Room", response: "Confirmed" },
    ],
    notifications: [
      { title: "Final Clearances Complete", message: "All clearances and final crossmatch are complete. Awaiting surgery schedule assignment.", type: "urgent" },
    ],
  },
  {
    hrn: "KTP-2026-0007", // Orientation
    services: [
      { serviceType: "Laboratory", label: "Initial Workup Chemistry & CBC", status: "Planned", dueDate: "2026-10-09", phase: "Phase1" },
    ],
    checklistDone: [
      "Pre-transplant orientation", "Initial nephrology assessment",
    ],
    appointments: [
      { title: "New Patient Orientation & Intake", kind: "Workup", startsAt: "2026-10-08T09:00:00+08:00", location: "KT Coordinator Desk", response: "Confirmed" },
    ],
    notifications: [
      { title: "Welcome to KTP Portal", message: "Orientation packet received. Please prepare for your Phase 1 lab appointments.", type: "info" },
    ],
  },
];

export const SEED_MESSAGES = [
  {
    subject: "PhilHealth Z Benefit Claim Submission Schedule Q4",
    body: "All post-transplant recipients with medication and laboratory receipts are advised to submit claims at least 14 days before the deadline.",
    targetType: "All",
  },
  {
    subject: "Updated Laboratory Clinic Hours",
    body: "The Outpatient Laboratory opens from 6:30 AM to 4:00 PM on weekdays for transplant patient blood draws.",
    targetType: "All",
  },
] as const;

export async function seedClinicalDataPg(client: ReturnType<typeof postgres>): Promise<void> {
  const adminUser = await client`SELECT "id" FROM "ktp"."users" WHERE "role" = 'admin' LIMIT 1`;
  const adminId = adminUser[0]?.id ? Number(adminUser[0].id) : 1;

  for (const seed of CLINICAL_SEEDS) {
    const [patient] = await client`SELECT "id" FROM "ktp"."patients" WHERE "hrn" = ${seed.hrn} LIMIT 1`;
    if (!patient?.id) continue;
    const patientId = Number(patient.id);

    // 1. Checklist
    for (const name of seed.checklistDone) {
      const [item] = await client`SELECT "id" FROM "ktp"."checklistCatalog" WHERE "name" = ${name} LIMIT 1`;
      if (item?.id) {
        await client`
          INSERT INTO "ktp"."patientChecklist" ("patientId", "catalogId", "status", "doneDate")
          VALUES (${patientId}, ${Number(item.id)}, 'Done', '2026-09-20'::date)
          ON CONFLICT ("patientId", "catalogId") DO UPDATE SET "status" = 'Done';
        `;
      }
    }

    // 2. Services & Lab Results
    for (const s of seed.services) {
      const [existing] = await client`
        SELECT "id" FROM "ktp"."serviceRecords"
        WHERE "patientId" = ${patientId} AND "label" = ${s.label}
        LIMIT 1
      `;
      let serviceId = existing?.id ? Number(existing.id) : null;
      if (!serviceId) {
        const [inserted] = await client`
          INSERT INTO "ktp"."serviceRecords" (
            "patientId", "serviceType", "label", "status", "dueDate",
            "serviceDate", "claimDeadline", "claimFiledDate", "phase", "source"
          ) VALUES (
            ${patientId}, ${s.serviceType}, ${s.label}, ${s.status}, CAST(${s.dueDate} AS date),
            CAST(${s.serviceDate ?? null} AS date), CAST(${s.claimDeadline ?? null} AS date),
            CAST(${s.claimFiledDate ?? null} AS date), ${s.phase ?? null}, 'Manual'
          ) RETURNING "id"
        `;
        serviceId = inserted?.id ? Number(inserted.id) : null;
      }

      if (serviceId && s.labs && s.labs.length > 0) {
        for (const lab of s.labs) {
          const [test] = await client`SELECT "id", "low", "high" FROM "ktp"."labTests" WHERE "name" = ${lab.testName} LIMIT 1`;
          if (test?.id) {
            const [hasLab] = await client`
              SELECT "id" FROM "ktp"."labResults"
              WHERE "serviceRecordId" = ${serviceId} AND "labTestId" = ${Number(test.id)}
              LIMIT 1
            `;
            if (!hasLab?.id) {
              await client`
                INSERT INTO "ktp"."labResults" (
                  "serviceRecordId", "labTestId", "value", "lowSnapshot", "highSnapshot", "flag"
                ) VALUES (
                  ${serviceId}, ${Number(test.id)}, ${lab.value}, ${test.low ?? null}, ${test.high ?? null}, ${lab.flag ?? "Normal"}
                )
              `;
            }
          }
        }
      }
    }

    // 3. Appointments
    for (const appt of seed.appointments) {
      const [existingAppt] = await client`
        SELECT "id" FROM "ktp"."appointments"
        WHERE "patientId" = ${patientId} AND "title" = ${appt.title}
        LIMIT 1
      `;
      if (!existingAppt?.id) {
        await client`
          INSERT INTO "ktp"."appointments" (
            "patientId", "title", "kind", "startsAt", "location", "response"
          ) VALUES (
            ${patientId}, ${appt.title}, ${appt.kind}, CAST(${appt.startsAt} AS timestamp),
            ${appt.location}, ${appt.response ?? "Confirmed"}
          )
        `;
      }
    }

    // 4. Notifications
    for (const notif of seed.notifications) {
      const [existingNotif] = await client`
        SELECT "id" FROM "ktp"."notifications"
        WHERE "patientId" = ${patientId} AND "title" = ${notif.title}
        LIMIT 1
      `;
      if (!existingNotif?.id) {
        await client`
          INSERT INTO "ktp"."notifications" ("patientId", "title", "message", "type", "read")
          VALUES (${patientId}, ${notif.title}, ${notif.message}, ${notif.type}, false)
        `;
      }
    }
  }

  // 5. Messages
  for (const msg of SEED_MESSAGES) {
    const [existingMsg] = await client`SELECT "id" FROM "ktp"."messages" WHERE "subject" = ${msg.subject} LIMIT 1`;
    if (!existingMsg?.id) {
      const [insertedMsg] = await client`
        INSERT INTO "ktp"."messages" ("senderUserId", "subject", "body", "targetType")
        VALUES (${adminId}, ${msg.subject}, ${msg.body}, ${msg.targetType})
        RETURNING "id"
      `;
      if (insertedMsg?.id) {
        const patients = await client`SELECT "id" FROM "ktp"."patients" WHERE "status" = 'Active'`;
        for (const p of patients) {
          await client`
            INSERT INTO "ktp"."messageRecipients" ("messageId", "patientId")
            VALUES (${Number(insertedMsg.id)}, ${Number(p.id)})
          `;
        }
      }
    }
  }
}

export function seedClinicalDataSqlite(db: Database.Database): void {
  const adminRow = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as { id: number } | undefined;
  const adminId = adminRow?.id ?? 1;

  for (const seed of CLINICAL_SEEDS) {
    const patient = db.prepare("SELECT id FROM patients WHERE hrn = ?").get(seed.hrn) as { id: number } | undefined;
    if (!patient?.id) continue;
    const patientId = patient.id;

    // 1. Checklist
    for (const name of seed.checklistDone) {
      const item = db.prepare("SELECT id FROM checklistCatalog WHERE name = ?").get(name) as { id: number } | undefined;
      if (item?.id) {
        db.prepare(`
          INSERT INTO patientChecklist (patientId, catalogId, status, doneDate)
          VALUES (?, ?, 'Done', '2026-09-20')
          ON CONFLICT (patientId, catalogId) DO UPDATE SET status = 'Done'
        `).run(patientId, item.id);
      }
    }

    // 2. Services & Lab Results
    for (const s of seed.services) {
      const existing = db.prepare("SELECT id FROM serviceRecords WHERE patientId = ? AND label = ?").get(patientId, s.label) as { id: number } | undefined;
      let serviceId = existing?.id ?? null;
      if (!serviceId) {
        const info = db.prepare(`
          INSERT INTO serviceRecords (
            patientId, serviceType, label, status, dueDate,
            serviceDate, claimDeadline, claimFiledDate, phase, source
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Manual')
        `).run(
          patientId, s.serviceType, s.label, s.status, s.dueDate,
          s.serviceDate ?? null, s.claimDeadline ?? null, s.claimFiledDate ?? null, s.phase ?? null
        );
        serviceId = Number(info.lastInsertRowid);
      }

      if (serviceId && s.labs && s.labs.length > 0) {
        for (const lab of s.labs) {
          const test = db.prepare("SELECT id, low, high FROM labTests WHERE name = ?").get(lab.testName) as { id: number; low: string | null; high: string | null } | undefined;
          if (test?.id) {
            const hasLab = db.prepare("SELECT id FROM labResults WHERE serviceRecordId = ? AND labTestId = ?").get(serviceId, test.id);
            if (!hasLab) {
              db.prepare(`
                INSERT INTO labResults (serviceRecordId, labTestId, value, lowSnapshot, highSnapshot, flag)
                VALUES (?, ?, ?, ?, ?, ?)
              `).run(serviceId, test.id, lab.value, test.low, test.high, lab.flag ?? "Normal");
            }
          }
        }
      }
    }

    // 3. Appointments
    for (const appt of seed.appointments) {
      const existingAppt = db.prepare("SELECT id FROM appointments WHERE patientId = ? AND title = ?").get(patientId, appt.title);
      if (!existingAppt) {
        db.prepare(`
          INSERT INTO appointments (patientId, title, kind, startsAt, location, response)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(patientId, appt.title, appt.kind, appt.startsAt, appt.location, appt.response ?? "Confirmed");
      }
    }

    // 4. Notifications
    for (const notif of seed.notifications) {
      const existingNotif = db.prepare("SELECT id FROM notifications WHERE patientId = ? AND title = ?").get(patientId, notif.title);
      if (!existingNotif) {
        db.prepare(`
          INSERT INTO notifications (patientId, title, message, type, read)
          VALUES (?, ?, ?, ?, 0)
        `).run(patientId, notif.title, notif.message, notif.type);
      }
    }
  }

  // 5. Messages
  for (const msg of SEED_MESSAGES) {
    const existingMsg = db.prepare("SELECT id FROM messages WHERE subject = ?").get(msg.subject) as { id: number } | undefined;
    if (!existingMsg?.id) {
      const info = db.prepare(`
        INSERT INTO messages (senderUserId, subject, body, targetType)
        VALUES (?, ?, ?, ?)
      `).run(adminId, msg.subject, msg.body, msg.targetType);
      const messageId = Number(info.lastInsertRowid);
      const activePatients = db.prepare("SELECT id FROM patients WHERE status = 'Active'").all() as { id: number }[];
      for (const p of activePatients) {
        db.prepare("INSERT INTO messageRecipients (messageId, patientId) VALUES (?, ?)").run(messageId, p.id);
      }
    }
  }
}
