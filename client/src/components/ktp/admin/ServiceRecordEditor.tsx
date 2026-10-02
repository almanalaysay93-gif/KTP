import { Link } from "wouter";
import { ClayCard, ClayInput } from "@/components/clay";
import { trpc } from "@/lib/trpc";
import { todayDate } from "@shared/ktp";
import type { ClinicalData } from "./PatientClinicalTabs";
import { ClinicalForm, field } from "./ClinicalForm";
import { serviceNames } from "./ClinicalTracker";
import { getNormalValue, groupEntries } from "./labCatalogMeta";

/*
 * Corrections to saved service records, shown on the patient edit page. Each save needs a reason:
 * the server keeps the values before and after the change with that reason.
 */

type Service = ClinicalData["services"][number];
type Props = { patientId: number; data: ClinicalData };

/** Sends a field only when it differs from the saved value. */
const changed = (next: string, saved: string | null) =>
  next === (saved ?? "") ? undefined : next;
/** Same, for a field that the user can clear. */
const changedOrCleared = (next: string, saved: string | null) =>
  next === (saved ?? "") ? undefined : next || null;

function Reason() {
  return (
    <ClayInput
      name="reason"
      label="Reason for correction"
      hint="Saved in the patient history with the values before and after."
      minLength={3}
      maxLength={500}
      required
    />
  );
}

function TrackerLink({ patientId }: { patientId: number }) {
  return (
    <Link
      href={`/patients/${patientId}?tab=tracker`}
      className="clay-focus mt-2 inline-flex min-h-11 items-center text-brick"
    >
      Open Tracker
    </Link>
  );
}

export function LabCorrections({ patientId, data }: Props) {
  const services = data.services.filter(
    s =>
      s.status === "Done" &&
      (s.serviceType === "Laboratory" || s.serviceType === "Tacro")
  );
  if (services.length === 0)
    return (
      <ClayCard className="min-w-0 p-5">
        <h2 className="type-headline">Lab results</h2>
        <p className="mt-2">
          No saved lab results. Record a result for a laboratory or tacrolimus
          service in Tracker first.
        </p>
        <TrackerLink patientId={patientId} />
      </ClayCard>
    );
  return (
    <div className="space-y-5">
      {services.map((service, index) => (
        <LabCard
          key={service.id}
          patientId={patientId}
          data={data}
          service={service}
          open={index === 0}
        />
      ))}
    </div>
  );
}

function LabCard({
  patientId,
  data,
  service,
  open,
}: Props & { service: Service; open: boolean }) {
  const update = trpc.clinical.updateService.useMutation();
  const saved = new Map(
    data.labResults
      .filter(r => r.serviceRecordId === service.id)
      .map(r => [r.labTestId, r.value])
  );
  return (
    <ClayCard className="min-w-0 p-5">
      <h2 className="type-headline break-words">{service.label}</h2>
      <p className="type-body-sm text-ink-muted">
        {serviceNames[service.serviceType]} · Service date {service.serviceDate}{" "}
        · {saved.size} {saved.size === 1 ? "value" : "values"} saved
      </p>
      <details open={open} className="pt-2">
        <summary className="clay-focus cursor-pointer py-2 font-bold">
          Edit lab values
        </summary>
        <ClinicalForm
          patientId={patientId}
          label="Save lab corrections"
          submit={form =>
            update.mutateAsync({
              patientId,
              id: service.id,
              reason: field(form, "reason"),
              serviceDate: changed(
                field(form, "serviceDate"),
                service.serviceDate
              ),
              results: data.labTests.flatMap(test => {
                const value = field(form, `lab-${test.id}`);
                return value === (saved.get(test.id) ?? "")
                  ? []
                  : [{ labTestId: test.id, value }];
              }),
            })
          }
        >
          {/* New key after each save: the inputs show the saved values and an empty reason. */}
          <div
            key={JSON.stringify([service.serviceDate, [...saved]])}
            className="grid min-w-0 gap-4"
          >
            <ClayInput
              name="serviceDate"
              label="Service date"
              type="date"
              defaultValue={service.serviceDate ?? ""}
              max={todayDate()}
              required
            />
            <fieldset className="min-w-0">
              <legend className="mb-3 font-bold">Lab values</legend>
              <p className="mb-3 type-body-sm text-ink-muted">
                Change a value to correct it. Clear a value to remove it. Fill
                an empty test to add it.
              </p>
              {data.labTests.length === 0 && (
                <p>No active lab tests configured.</p>
              )}
              <div className="grid min-w-0 gap-5">
                {groupEntries(data.labTests).map(({ group, entries }) => (
                  <div key={group} role="group" aria-label={group} className="min-w-0">
                    <p className="mb-2 border-b border-hairline pb-1 type-label text-ink-muted">
                      {group}
                    </p>
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      {entries.map(test => (
                        <ClayInput
                          key={test.id}
                          name={`lab-${test.id}`}
                          label={`${test.name} (${test.unit})`}
                          hint={
                            getNormalValue(test.name)
                              ? `Normal: ${getNormalValue(test.name)}`
                              : undefined
                          }
                          inputMode="decimal"
                          maxLength={100}
                          defaultValue={saved.get(test.id) ?? ""}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
            <Reason />
          </div>
        </ClinicalForm>
      </details>
    </ClayCard>
  );
}

export function ServiceCorrections({
  patientId,
  data,
  title,
  dateTerm,
}: Props & { title: string; dateTerm: string }) {
  const services = data.services.filter(s => s.status !== "Superseded");
  return (
    <div className="space-y-5">
      <ClayCard className="min-w-0 p-5">
        <h2 className="type-headline">{title}</h2>
        <p className="mt-2 type-body-sm text-ink-muted">
          The {dateTerm}, the follow-up interval, and the doctors are in the
          Profile section. The service records are below. Lab values are in the
          Labs section.
        </p>
        {services.length === 0 && (
          <>
            <p className="mt-4">
              No service records. Schedule a service in Tracker first.
            </p>
            <TrackerLink patientId={patientId} />
          </>
        )}
      </ClayCard>
      {services.map(service => (
        <ServiceCard key={service.id} patientId={patientId} service={service} />
      ))}
    </div>
  );
}

function ServiceCard({
  patientId,
  service,
}: {
  patientId: number;
  service: Service;
}) {
  const update = trpc.clinical.updateService.useMutation();
  const done = service.status === "Done";
  return (
    <ClayCard className="min-w-0 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 font-bold break-words">{service.label}</h3>
        <span className="type-body-sm">{service.status}</span>
      </div>
      <p className="type-body-sm text-ink-muted">
        {serviceNames[service.serviceType]} · Due {service.dueDate}
        {service.serviceDate ? ` · Completed ${service.serviceDate}` : ""}
      </p>
      <details className="pt-2">
        <summary className="clay-focus cursor-pointer py-2 font-bold">
          Edit service record
        </summary>
        <ClinicalForm
          patientId={patientId}
          label="Save service corrections"
          submit={form =>
            update.mutateAsync({
              patientId,
              id: service.id,
              reason: field(form, "reason"),
              label: changed(field(form, "label"), service.label),
              dueDate: changed(field(form, "dueDate"), service.dueDate),
              serviceDate: done
                ? changed(field(form, "serviceDate"), service.serviceDate)
                : undefined,
              claimDeadline: changedOrCleared(
                field(form, "claimDeadline"),
                service.claimDeadline
              ),
              claimFiledDate: done
                ? changedOrCleared(
                    field(form, "claimFiledDate"),
                    service.claimFiledDate
                  )
                : undefined,
              note: changedOrCleared(field(form, "note"), service.note),
            })
          }
        >
          <div
            key={JSON.stringify(service)}
            className="grid min-w-0 gap-4"
          >
            <ClayInput
              name="label"
              label="Service name"
              maxLength={200}
              defaultValue={service.label}
              required
            />
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <ClayInput
                name="dueDate"
                label="Due date"
                type="date"
                defaultValue={service.dueDate}
                required
              />
              {done && (
                <ClayInput
                  name="serviceDate"
                  label="Service date"
                  type="date"
                  defaultValue={service.serviceDate ?? ""}
                  max={todayDate()}
                  required
                />
              )}
              <ClayInput
                name="claimDeadline"
                label="Claim deadline (optional)"
                type="date"
                defaultValue={service.claimDeadline ?? ""}
              />
              {done && (
                <ClayInput
                  name="claimFiledDate"
                  label="Claim filed date (optional)"
                  type="date"
                  defaultValue={service.claimFiledDate ?? ""}
                  max={todayDate()}
                />
              )}
            </div>
            <ClayInput
              name="note"
              label="Note (optional)"
              maxLength={2000}
              defaultValue={service.note ?? ""}
            />
            <Reason />
          </div>
        </ClinicalForm>
      </details>
    </ClayCard>
  );
}
