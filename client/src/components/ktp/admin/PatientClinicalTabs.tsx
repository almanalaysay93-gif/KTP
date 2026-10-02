import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../../server/routers";
import { ClayButton, ClayCard, ClayInput } from "@/components/clay";
import { trpc } from "@/lib/trpc";
import { dateKey, todayDate } from "@shared/ktp";
import { ClinicalForm, ClinicalSelect, field } from "./ClinicalForm";
import { ClinicalTracker } from "./ClinicalTracker";

export type ClinicalData = inferRouterOutputs<AppRouter>["clinical"]["get"];
export function PatientClinicalTabs({
  patientId,
  tab,
  patient,
}: {
  patientId: number;
  tab: string;
  patient?: any;
}) {
  const query = trpc.clinical.get.useQuery({ patientId });
  if (query.isLoading) return <p role="status">Loading clinical records...</p>;
  if (query.isError)
    return (
      <ClayCard className="p-5">
        <p role="alert">Could not load clinical records.</p>
        <ClayButton onClick={() => query.refetch()}>Retry</ClayButton>
      </ClayCard>
    );
  if (!query.data) return null;
  if (tab === "tracker")
    return <ClinicalTracker patientId={patientId} data={query.data} patient={patient} />;
  if (tab === "labs") return <Labs data={query.data} />;
  if (tab === "checklist")
    return <Checklist patientId={patientId} data={query.data} />;
  if (tab === "appointments")
    return <Appointments patientId={patientId} data={query.data} />;
  return null;
}

function Labs({ data }: { data: ClinicalData }) {
  return (
    <ClayCard className="min-w-0 p-5">
      <h2 className="type-headline">Lab results</h2>
      <p className="mt-2 type-body-sm text-ink-muted">
        Record values through a scheduled service in Tracker. Reference ranges
        use the saved laboratory range.
      </p>
      {data.labResults.length === 0 ? (
        <p className="mt-4">No lab results recorded.</p>
      ) : (
        <ul className="mt-4 divide-y divide-hairline">
          {data.labResults.map(result => (
            <li
              key={result.id}
              className="flex flex-wrap justify-between gap-3 py-4"
            >
              <div className="min-w-0 break-words">
                <strong>{result.testName}</strong>
                <p className="type-body-sm">
                  {dateKey(result.serviceDate) ?? "Date not recorded"}
                </p>
              </div>
              <div>
                <p className="font-mono">
                  {result.value} {result.unit}
                </p>
                <p className="type-body-sm">{result.flag ?? "Range not set"}</p>
                {(result.lowSnapshot !== null ||
                  result.highSnapshot !== null) && (
                  <p className="type-caption">
                    Range: {result.lowSnapshot ?? "—"} to{" "}
                    {result.highSnapshot ?? "—"}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ClayCard>
  );
}

function Checklist({
  patientId,
  data,
}: {
  patientId: number;
  data: ClinicalData;
}) {
  const mutation = trpc.clinical.setChecklist.useMutation();
  return (
    <div className="space-y-4">
      <h2 className="type-headline">Workup checklist</h2>
      {data.checklist.length === 0 && (
        <p>No checklist items configured for this patient type.</p>
      )}
      {data.checklist.map(item => (
        <ClayCard
          key={`${item.catalogId}-${item.status}-${item.doneDate}-${item.note}`}
          className="min-w-0 p-5"
        >
          <h3 className="mb-2 font-bold break-words">{item.name}</h3>
          <p className="mb-4 type-body-sm text-ink-muted">
            {item.category}
            {item.phase ? ` · Phase ${item.phase}` : ""}
            {item.asIndicated ? " · As indicated" : ""}
          </p>
          <ClinicalForm
            patientId={patientId}
            label="Save checklist item"
            submit={form =>
              mutation.mutateAsync({
                patientId,
                catalogId: item.catalogId,
                status: field(form, "status") as "Pending" | "Done" | "NA",
                doneDate: field(form, "doneDate") || undefined,
                note: field(form, "note"),
              })
            }
          >
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <ClinicalSelect
                name="status"
                label="Status"
                defaultValue={item.status}
              >
                <option value="Pending">Pending</option>
                <option value="Done">Done</option>
                <option value="NA">Not applicable</option>
              </ClinicalSelect>
              <ClayInput
                name="doneDate"
                label="Completion date (for Done)"
                type="date"
                max={todayDate()}
                defaultValue={dateKey(item.doneDate) ?? ""}
              />
            </div>
            <ClayInput
              name="note"
              label="Note (optional)"
              maxLength={2000}
              defaultValue={item.note ?? ""}
            />
          </ClinicalForm>
        </ClayCard>
      ))}
    </div>
  );
}

function Appointments({
  patientId,
  data,
}: {
  patientId: number;
  data: ClinicalData;
}) {
  const add = trpc.clinical.addAppointment.useMutation();
  const cancel = trpc.clinical.cancelAppointment.useMutation();
  return (
    <div className="space-y-5">
      <ClayCard className="min-w-0 p-5">
        <h2 className="mb-4 type-headline">Schedule appointment</h2>
        <ClinicalForm
          patientId={patientId}
          label="Schedule appointment"
          reset
          submit={form =>
            add.mutateAsync({
              patientId,
              title: field(form, "title"),
              kind: field(form, "kind") as
                | "FollowUp"
                | "Biopsy"
                | "Workup"
                | "Clearance"
                | "Other",
              startsAt: new Date(
                `${field(form, "startsAt")}:00+08:00`
              ).toISOString(),
              location: field(form, "location"),
              note: field(form, "note"),
            })
          }
        >
          <ClayInput
            name="title"
            label="Appointment title"
            maxLength={200}
            required
          />
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <ClinicalSelect name="kind" label="Kind">
              <option value="FollowUp">Follow-up</option>
              <option>Biopsy</option>
              <option>Workup</option>
              <option>Clearance</option>
              <option>Other</option>
            </ClinicalSelect>
            <ClayInput
              name="startsAt"
              label="Date and time (Manila)"
              type="datetime-local"
              required
            />
          </div>
          <ClayInput
            name="location"
            label="Location (optional)"
            maxLength={300}
          />
          <ClayInput name="note" label="Note (optional)" maxLength={2000} />
        </ClinicalForm>
      </ClayCard>
      <h2 className="type-headline">Appointments</h2>
      {data.appointments.length === 0 && <p>No appointments scheduled.</p>}
      {data.appointments.map(item => (
        <ClayCard key={item.id} className="min-w-0 space-y-3 break-words p-5">
          <h3 className="font-bold">{item.title}</h3>
          <p>
            {new Date(item.startsAt).toLocaleString("en-PH", {
              timeZone: "Asia/Manila",
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            (Manila)
          </p>
          {item.location && <p>{item.location}</p>}
          {item.note && <p>{item.note}</p>}
          <p className="type-body-sm">
            {item.cancelledAt
              ? "Cancelled"
              : `Patient response: ${item.response === "RescheduleRequested" ? "Reschedule requested" : item.response}`}
          </p>
          {item.responseNote && (
            <p className="type-body-sm">Patient note: {item.responseNote}</p>
          )}
          {!item.cancelledAt && (
            <ClinicalForm
              patientId={patientId}
              label="Cancel appointment"
              submit={() => cancel.mutateAsync({ patientId, id: item.id })}
            >
              <label className="flex items-start gap-2 type-body-sm">
                <input
                  type="checkbox"
                  required
                  className="mt-1 size-4 shrink-0"
                />
                Confirm cancellation of this appointment.
              </label>
            </ClinicalForm>
          )}
        </ClayCard>
      ))}
    </div>
  );
}
