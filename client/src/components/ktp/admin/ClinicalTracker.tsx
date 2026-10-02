import { useState } from "react";
import { ClayButton, ClayCard, ClayInput } from "@/components/clay";
import { trpc } from "@/lib/trpc";
import { dateKey, todayDate } from "@shared/ktp";
import type { ClinicalData } from "./PatientClinicalTabs";
import { ClinicalForm, ClinicalSelect, field } from "./ClinicalForm";

const serviceNames = {
  Meds: "Medicines",
  Laboratory: "Laboratory",
  Tacro: "Tacrolimus",
  XrayUsd: "X-ray / ultrasound",
};

export function ClinicalTracker({
  patientId,
  data,
}: {
  patientId: number;
  data: ClinicalData;
}) {
  const add = trpc.clinical.addService.useMutation();
  return (
    <div
      id="clinical-tracker"
      tabIndex={-1}
      className="min-w-0 space-y-5 scroll-mt-20"
    >
      <ClayCard className="min-w-0 p-5">
        <h2 className="mb-4 type-headline">Schedule service</h2>
        <ClinicalForm
          patientId={patientId}
          label="Add service"
          reset
          submit={form =>
            add.mutateAsync({
              patientId,
              serviceType: field(
                form,
                "serviceType"
              ) as keyof typeof serviceNames,
              label: field(form, "label"),
              dueDate: field(form, "dueDate"),
              note: field(form, "note"),
            })
          }
        >
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <ClinicalSelect name="serviceType" label="Service type">
              {Object.entries(serviceNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </ClinicalSelect>
            <ClayInput name="dueDate" label="Due date" type="date" required />
          </div>
          <ClayInput
            name="label"
            label="Service name"
            maxLength={200}
            placeholder="Enter the ordered service"
            required
          />
          <ClayInput name="note" label="Note (optional)" maxLength={2000} />
        </ClinicalForm>
      </ClayCard>
      <h2 className="type-headline">Service records</h2>
      {data.services.length === 0 && (
        <p>No services scheduled. Add a service to record its result.</p>
      )}
      {data.services.map(service => (
        <ServiceCard
          key={service.id}
          patientId={patientId}
          service={service}
          tests={data.labTests}
        />
      ))}
    </div>
  );
}

function ServiceCard({
  patientId,
  service,
  tests,
}: {
  patientId: number;
  service: ClinicalData["services"][number];
  tests: ClinicalData["labTests"];
}) {
  const result = trpc.clinical.recordResult.useMutation();
  const claim = trpc.clinical.fileClaim.useMutation();
  const [open, setOpen] = useState(false);
  const canEnterLabs =
    service.serviceType === "Laboratory" || service.serviceType === "Tacro";
  return (
    <ClayCard className="min-w-0 space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 font-bold break-words">{service.label}</h3>
        <span className="type-body-sm">{service.status}</span>
      </div>
      <p className="type-body-sm">
        {serviceNames[service.serviceType]} · Due {dateKey(service.dueDate)}
      </p>
      {service.serviceDate && (
        <p className="type-body-sm">Completed {dateKey(service.serviceDate)}</p>
      )}
      {service.note && (
        <p className="type-body-sm break-words">{service.note}</p>
      )}
      {service.claimDeadline && (
        <p className="type-body-sm">
          Claim deadline: {dateKey(service.claimDeadline)}
        </p>
      )}
      {service.claimFiledDate && (
        <p className="type-body-sm">
          Claim filed: {dateKey(service.claimFiledDate)}
        </p>
      )}
      {service.status === "Planned" && (
        <>
          <ClayButton
            variant="secondary"
            aria-expanded={open}
            onClick={() => setOpen(value => !value)}
          >
            {open ? "Close result form" : "Record result"}
          </ClayButton>
          {open && (
            <ClinicalForm
              patientId={patientId}
              label="Save result"
              submit={form =>
                result.mutateAsync({
                  patientId,
                  serviceRecordId: service.id,
                  serviceDate: field(form, "serviceDate"),
                  claimDeadline: field(form, "claimDeadline") || undefined,
                  note: field(form, "note"),
                  results: canEnterLabs
                    ? tests
                        .filter(test => field(form, `lab-${test.id}`) !== "")
                        .map(test => ({
                          labTestId: test.id,
                          value: field(form, `lab-${test.id}`),
                        }))
                    : [],
                })
              }
            >
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <ClayInput
                  name="serviceDate"
                  label="Service date"
                  type="date"
                  defaultValue={todayDate()}
                  max={todayDate()}
                  required
                />
                <ClayInput
                  name="claimDeadline"
                  label="Claim deadline (optional)"
                  type="date"
                />
              </div>
              {canEnterLabs && (
                <fieldset className="min-w-0">
                  <legend className="mb-3 font-bold">Lab values</legend>
                  <p className="mb-3 type-body-sm text-ink-muted">
                    Enter measured values only. Leave unmeasured tests blank.
                  </p>
                  {tests.length === 0 && <p>No active lab tests configured.</p>}
                  <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                    {tests.map(test => (
                      <ClayInput
                        key={test.id}
                        name={`lab-${test.id}`}
                        label={`${test.name} (${test.unit})`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                      />
                    ))}
                  </div>
                </fieldset>
              )}
              <ClayInput
                name="note"
                label="Result note (optional)"
                maxLength={2000}
                defaultValue={service.note ?? ""}
              />
            </ClinicalForm>
          )}
        </>
      )}
      {service.status === "Done" && !service.claimFiledDate && (
        <details className="pt-2">
          <summary className="clay-focus cursor-pointer py-2 font-bold">
            Mark claim filed
          </summary>
          <ClinicalForm
            patientId={patientId}
            label="Save claim date"
            submit={form =>
              claim.mutateAsync({
                patientId,
                id: service.id,
                claimFiledDate: field(form, "claimFiledDate"),
              })
            }
          >
            <ClayInput
              name="claimFiledDate"
              label="Date filed"
              type="date"
              defaultValue={todayDate()}
              max={todayDate()}
              required
            />
          </ClinicalForm>
        </details>
      )}
    </ClayCard>
  );
}
