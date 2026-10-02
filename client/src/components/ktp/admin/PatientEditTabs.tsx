import { useState, type ReactNode } from "react";
import {
  ClayButton,
  ClayCard,
  ClayTabs,
  ClayTabsContent,
  ClayTabsList,
  ClayTabsTrigger,
} from "@/components/clay";
import { trpc } from "@/lib/trpc";
import { dateKey, todayDate, type PatientType } from "@shared/ktp";
import { ClinicalForm, field } from "./ClinicalForm";
import type { ClinicalData } from "./PatientClinicalTabs";
import { LabCorrections, ServiceCorrections } from "./ServiceRecordEditor";

/*
 * Sections of the patient edit page. Profile holds the patient form (the children). The other
 * sections edit the clinical records: lab values, work-up phases, clearances, PhilHealth Z, and
 * the service records after surgery. Without a patient ID (enrolment) only the form shows.
 */

type Item = ClinicalData["checklist"][number];
type Group = { title: string; match: (item: Item) => boolean };

const isPhilHealth = (item: Item) =>
  item.category === "Milestone" && /philhealth/i.test(item.name);

const CHECKLIST_GROUPS: Record<string, Group[]> = {
  phases: [
    {
      title: "Orientation and milestones",
      match: item => item.category === "Milestone" && !isPhilHealth(item),
    },
    { title: "Phase 1", match: item => item.phase === 1 },
    { title: "Phase 2", match: item => item.phase === 2 },
    { title: "Phase 3", match: item => item.phase === 3 },
  ],
  clearances: [
    {
      title: "Clearances",
      match: item => item.category === "Clearance" && item.phase == null,
    },
  ],
  philhealth: [{ title: "PhilHealth Z", match: isPhilHealth }],
};

const control =
  "clay-sunken clay-focus h-12 w-full min-w-0 rounded-sm border border-line-strong px-3 type-body disabled:opacity-50";

export function PatientEditTabs({
  patientId,
  patientType,
  children,
}: {
  patientId?: number;
  patientType: PatientType;
  children: ReactNode;
}) {
  const [tab, setTab] = useState("profile");
  if (!patientId) return <>{children}</>;
  const recipient = patientType === "Recipient";
  return (
    <ClayTabs value={tab} onValueChange={setTab} className="mt-6">
      <ClayTabsList
        aria-label="Patient record sections"
        className="h-auto w-full flex-wrap overflow-visible rounded-2xl sm:w-fit"
      >
        <ClayTabsTrigger value="profile">Profile</ClayTabsTrigger>
        <ClayTabsTrigger value="labs">Labs</ClayTabsTrigger>
        <ClayTabsTrigger value="phases">Phases</ClayTabsTrigger>
        <ClayTabsTrigger value="clearances">Clearances</ClayTabsTrigger>
        {recipient && (
          <ClayTabsTrigger value="philhealth">PhilHealth Z</ClayTabsTrigger>
        )}
        <ClayTabsTrigger value="postkt">
          {recipient ? "Post-KT" : "Post-donation"}
        </ClayTabsTrigger>
      </ClayTabsList>
      <ClayTabsContent value="profile">{children}</ClayTabsContent>
      {tab !== "profile" && (
        <ClayTabsContent value={tab} className="mt-4">
          <ClinicalSection
            patientId={patientId}
            section={tab}
            recipient={recipient}
          />
        </ClayTabsContent>
      )}
    </ClayTabs>
  );
}

function ClinicalSection({
  patientId,
  section,
  recipient,
}: {
  patientId: number;
  section: string;
  recipient: boolean;
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
  if (section === "labs")
    return <LabCorrections patientId={patientId} data={query.data} />;
  if (section === "postkt")
    return (
      <ServiceCorrections
        patientId={patientId}
        data={query.data}
        title={recipient ? "Post-KT details" : "Post-donation details"}
        dateTerm={recipient ? "transplant date" : "donation date"}
      />
    );
  const groups = (CHECKLIST_GROUPS[section] ?? [])
    .map(group => ({
      title: group.title,
      items: query.data.checklist.filter(group.match),
    }))
    .filter(group => group.items.length > 0);
  if (groups.length === 0)
    return <p>No checklist items configured for this section.</p>;
  return (
    <div className="space-y-5">
      {groups.map(group => (
        <ChecklistGroup key={group.title} patientId={patientId} {...group} />
      ))}
    </div>
  );
}

function ChecklistGroup({
  patientId,
  title,
  items,
}: {
  patientId: number;
  title: string;
  items: Item[];
}) {
  const save = trpc.clinical.setChecklistMany.useMutation();
  const done = items.filter(item => item.status === "Done").length;
  return (
    <ClayCard className="min-w-0 p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="type-headline">{title}</h2>
        <p className="type-body-sm text-ink-muted">
          {done} of {items.length} done
        </p>
      </div>
      <ClinicalForm
        patientId={patientId}
        label={`Save ${title}`}
        submit={async form => {
          const changes = items.flatMap(item => {
            const status = field(
              form,
              `status-${item.catalogId}`
            ) as Item["status"];
            const doneDate =
              status === "Done" ? field(form, `doneDate-${item.catalogId}`) : "";
            const note = field(form, `note-${item.catalogId}`);
            const savedDate =
              item.status === "Done" ? dateKey(item.doneDate) : "";
            if (
              status === item.status &&
              doneDate === savedDate &&
              note === (item.note ?? "")
            )
              return [];
            if (status === "Done" && !doneDate)
              throw new Error(`Completion date is required: ${item.name}`);
            return [
              {
                catalogId: item.catalogId,
                status,
                doneDate: doneDate || undefined,
                note,
              },
            ];
          });
          if (changes.length === 0) throw new Error("No change to save.");
          await save.mutateAsync({ patientId, items: changes });
        }}
      >
        <ul className="divide-y divide-hairline">
          {items.map(item => (
            <ChecklistRow
              key={`${item.catalogId}-${item.status}-${item.doneDate}-${item.note}`}
              item={item}
            />
          ))}
        </ul>
      </ClinicalForm>
    </ClayCard>
  );
}

function ChecklistRow({ item }: { item: Item }) {
  const [status, setStatus] = useState(item.status);
  const [doneDate, setDoneDate] = useState(dateKey(item.doneDate));
  return (
    <li className="grid min-w-0 gap-3 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="font-bold break-words">{item.name}</p>
        <p className="type-body-sm text-ink-muted">
          {item.category}
          {item.asIndicated ? " · As indicated" : ""}
        </p>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[10rem_11rem_1fr]">
        <select
          name={`status-${item.catalogId}`}
          aria-label={`Status: ${item.name}`}
          value={status}
          onChange={event => {
            const next = event.target.value as Item["status"];
            setStatus(next);
            if (next === "Done" && !doneDate) setDoneDate(todayDate());
          }}
          className={control}
        >
          <option value="Pending">Pending</option>
          <option value="Done">Done</option>
          <option value="NA">Not applicable</option>
        </select>
        <input
          type="date"
          name={`doneDate-${item.catalogId}`}
          aria-label={`Completion date: ${item.name}`}
          value={status === "Done" ? doneDate : ""}
          onChange={event => setDoneDate(event.target.value)}
          max={todayDate()}
          required={status === "Done"}
          disabled={status !== "Done"}
          className={control}
        />
        <input
          name={`note-${item.catalogId}`}
          aria-label={`Note: ${item.name}`}
          placeholder="Note (optional)"
          maxLength={2000}
          defaultValue={item.note ?? ""}
          className={control}
        />
      </div>
    </li>
  );
}
