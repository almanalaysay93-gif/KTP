import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { checkImportRows, commitImportRows } from "../dbPatientImport";

// The values are text from a file. The check gives a message for each wrong value, so the
// schema limits only the size.
const value = z.string().max(400).nullable().optional();
const row = z.object({
  hrn: value, patientType: value, firstName: value, middleName: value, lastName: value, suffix: value,
  sex: value, birthDate: value, contactNumber: value, accountEmail: value, stage: value, riskCategory: value,
  surgeryDate: value, status: value, nephrologist: value, fellow: value, linkedRecipientHrn: value,
  followupMonths: z.union([z.number(), z.string().max(10)]).nullable().optional(),
});
const rows = z.array(row).min(1).max(200);

export const patientImportRouter = router({
  /** Errors and warnings for each row. Writes nothing. */
  check: adminProcedure.input(z.object({ rows })).mutation(({ input }) => checkImportRows(input.rows)),
  /** Saves all rows in one transaction. One wrong row stops the save of all rows. */
  commit: adminProcedure
    .input(z.object({ rows, fileName: z.string().trim().max(255).default("") }))
    .mutation(({ input, ctx }) => commitImportRows(input.rows, ctx.user.id, input.fileName)),
});
