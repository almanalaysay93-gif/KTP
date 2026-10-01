import { adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { todayDate } from "@shared/ktp";

export const dashboardRouter = router({
  initial: adminProcedure.query(async () => {
    const patients = await db.listPatients();
    const today = todayDate();

    // Stage & type counts
    const active = patients.filter(p => p.status === "Active");
    const recipients = active.filter(p => p.patientType === "Recipient");
    const donors = active.filter(p => p.patientType === "Donor");

    const recipientStages: Record<string, number> = {};
    for (const p of recipients) {
      recipientStages[p.stage] = (recipientStages[p.stage] || 0) + 1;
    }

    const donorStages: Record<string, number> = {};
    for (const p of donors) {
      donorStages[p.stage] = (donorStages[p.stage] || 0) + 1;
    }

    // In Phase A2, services and appointments are empty until Phase A3 tables are populated
    return {
      today,
      patients,
      activeCount: active.length,
      totalPatients: patients.length,
      recipientCount: recipients.length,
      donorCount: donors.length,
      recipientStages,
      donorStages,
      overdueServices: [],
      claimsDueSoon: [],
      rescheduleRequests: [],
      supersededUnfiledClaims: [],
    };
  }),
});
