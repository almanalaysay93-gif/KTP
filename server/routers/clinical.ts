import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import * as clinical from "../dbClinical";
import { parseLabBuffer } from "../labOcrBridge";
import { todayDate } from "../../shared/ktp";

const id = z.number().int().positive().safe();
const patient = z.object({ patientId: id });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value >= "1900-01-01";
}, "Use a valid calendar date");
const pastDate = date.refine(value => value <= todayDate(), "Date cannot be in the future");
const note = z.string().trim().max(4000).optional();

export const clinicalRouter = router({
  get: adminProcedure.input(patient).query(({ input }) => clinical.getClinical(input.patientId)),
  listAppointments: adminProcedure.query(() => clinical.listAllAppointments()),
  addService: adminProcedure.input(patient.extend({
    serviceType: z.enum(["Meds", "Laboratory", "Tacro", "XrayUsd"]),
    label: z.string().trim().min(1).max(200), dueDate: date, note,
  })).mutation(({ input, ctx }) => clinical.addService(input, ctx.user.id)),
  recordResult: adminProcedure.input(patient.extend({
    serviceRecordId: id, serviceDate: pastDate, claimDeadline: date.optional(), note,
    nurseApproved: z.boolean().optional(),
    approvedByNurse: z.string().trim().max(200).optional(),
    results: z.array(z.object({ labTestId: id, value: z.string().trim().min(1).max(100) })).max(100).optional(),
  }).refine(input => !input.claimDeadline || input.claimDeadline >= input.serviceDate, "Claim deadline cannot precede service date")
    .refine(input => new Set(input.results?.map(row => row.labTestId)).size === (input.results?.length ?? 0), "Each lab test may occur once"))
    .mutation(({ input, ctx }) => clinical.recordResult(input, ctx.user.id)),
  setChecklist: adminProcedure.input(patient.extend({
    catalogId: id, status: z.enum(["Pending", "Done", "NA"]), doneDate: pastDate.optional(), note,
  }).refine(input => input.status !== "Done" || !!input.doneDate, "Completion date is required"))
    .mutation(({ input, ctx }) => clinical.setChecklist(input, ctx.user.id)),
  addAppointment: adminProcedure.input(patient.extend({
    title: z.string().trim().min(1).max(200), kind: z.enum(["FollowUp", "Biopsy", "Workup", "Clearance", "Other"]),
    startsAt: z.string().datetime({ offset: true }).refine(value => Number.isFinite(new Date(value).getTime()), "Invalid appointment time"),
    location: z.string().trim().max(300).optional(), note,
  })).mutation(({ input, ctx }) => clinical.addAppointment(input, ctx.user.id)),
  cancelAppointment: adminProcedure.input(patient.extend({ id })).mutation(({ input, ctx }) => clinical.cancelAppointment(input, ctx.user.id)),
  fileClaim: adminProcedure.input(patient.extend({ id, claimFiledDate: pastDate })).mutation(({ input, ctx }) => clinical.fileClaim(input, ctx.user.id)),
  parseLabDocument: adminProcedure
    .input(
      z.object({
        base64: z.string().min(10),
        fileName: z.string().max(255).default("document.pdf"),
      })
    )
    .mutation(async ({ input }) => {
      const cleanBase64 = input.base64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");
      return parseLabBuffer(buffer, input.fileName);
    }),
});
