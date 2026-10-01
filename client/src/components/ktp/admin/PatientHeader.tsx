import { ChevronLeft, ClipboardPen, Pencil, Send } from "lucide-react";
import { Link } from "wouter";
import { ClayAvatar, ClayAvatarPair } from "@/components/clay";
import { MotionClayButton, MotionStepper } from "@/components/motion";
import {
  DONOR_STAGES,
  RECIPIENT_STAGES,
  daysSinceSurgery,
  patientDisplayName,
  type Doctor,
  type Patient,
} from "@/pages/preview/mock";
import { fmtDate } from "./format";

/*
 * Patient profile header (DESIGN.md Screens 4): name first, then where they are on the stage
 * stepper, then the people around them (doctors, linked donor or recipient). Actions sit top-right:
 * two secondaries and one brick primary.
 */

const STEP_SHORT: Record<string, string> = {
  Orientation: "Orientation",
  Phase1: "Phase 1",
  Phase2: "Phase 2",
  Clearances: "Clearances",
  PhilHealthZ: "PhilHealth Z",
  Phase3: "Phase 3",
  PostKT: "Post-KT",
  PostDonation: "Post-donation",
};

const RISK_LABEL = { StandardLow: "Standard or low", High: "High" } as const;

export interface PatientHeaderProps {
  patient: Patient;
  linked: Patient | null;
  doctors: Doctor[];
  backHref: string;
  onRecordResult: () => void;
  onSendMessage: () => void;
  onEdit: () => void;
  onOpenLinked: (patient: Patient) => void;
  /** Slot beside the back link, for example the "Sample data" badge. */
  badge?: React.ReactNode;
}

export function PatientHeader({ patient, linked, doctors, backHref, onRecordResult, onSendMessage, onEdit, onOpenLinked, badge }: PatientHeaderProps) {
  const isRecipient = patient.patientType === "Recipient";
  const order = isRecipient ? RECIPIENT_STAGES : DONOR_STAGES;
  const steps = order.map((id) => ({ id, label: STEP_SHORT[id] }));
  const current = (order as readonly string[]).indexOf(patient.stage);
  const day = daysSinceSurgery(patient);
  const neph = doctors.find((d) => String(d.id) === String(patient.nephrologistId));
  const fellow = doctors.find((d) => String(d.id) === String(patient.fellowId));
  const name = patientDisplayName(patient);
  const recipient = isRecipient ? patient : linked;
  const donor = isRecipient ? linked : patient;

  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={backHref} className="clay-focus -ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 type-button text-brick hover:bg-sunken/60">
            <ChevronLeft aria-hidden className="size-5" strokeWidth={1.75} />
            Back to dashboard
          </Link>
          {badge}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MotionClayButton variant="secondary" size="sm" icon={<Send strokeWidth={1.75} />} onClick={onSendMessage} className="max-sm:hidden">
            Send message
          </MotionClayButton>
          <MotionClayButton variant="secondary" size="sm" icon={<Pencil strokeWidth={1.75} />} onClick={onEdit} className="max-sm:hidden">
            Edit patient
          </MotionClayButton>
          <MotionClayButton variant="icon" size="sm" aria-label="Send message" onClick={onSendMessage} className="sm:hidden">
            <Send strokeWidth={1.75} />
          </MotionClayButton>
          <MotionClayButton variant="icon" size="sm" aria-label="Edit patient" onClick={onEdit} className="sm:hidden">
            <Pencil strokeWidth={1.75} />
          </MotionClayButton>
          <MotionClayButton size="sm" icon={<ClipboardPen strokeWidth={1.75} />} onClick={onRecordResult}>
            Record result
          </MotionClayButton>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ClayAvatar name={name} kind={isRecipient ? "recipient" : "donor"} size={72} decorative className="max-sm:size-14 max-sm:text-xl" />
        <div className="min-w-0">
          <h1 className="type-display text-ink">{name}</h1>
          <p className="type-body-sm mt-1 flex flex-wrap items-baseline gap-x-2 text-ink-muted">
            <span className="type-data text-ink">{patient.hrn}</span>
            <span aria-hidden>·</span>
            <span>{patient.patientType}</span>
            <span aria-hidden>·</span>
            <span>
              {patient.age} y, {patient.sex}
            </span>
            <span aria-hidden>·</span>
            <span>{patient.status}</span>
          </p>
        </div>
      </div>

      <MotionStepper
        steps={steps}
        current={current}
        trailing={day !== null ? `${isRecipient ? "Post-KT" : "Post-donation"} day ${day}` : undefined}
      />

      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-[repeat(3,auto)_1fr]">
        <Fact term="Nephrologist" value={neph?.name ?? "Not set"} />
        <Fact term="Fellow in charge" value={fellow?.name ?? "Not set"} />
        <Fact
          term={isRecipient ? "Transplant date" : "Donation date"}
          value={<span className="type-data">{fmtDate(patient.surgeryDate)}</span>}
        />
        {linked && recipient && donor ? (
          <div className="flex min-w-0 flex-col gap-1 xl:justify-self-end">
            <dt className="type-label text-ink-muted">{isRecipient ? "Linked donor" : "Linked recipient"}</dt>
            <dd>
              <button
                type="button"
                onClick={() => onOpenLinked(linked)}
                aria-label={`Open profile of ${linked.lastName}, ${linked.firstName}, ${linked.hrn}`}
                className="clay-focus -mx-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-sunken/60"
              >
                <ClayAvatarPair
                  size={32}
                  recipient={{ name: patientDisplayName(recipient) }}
                  donor={{ name: patientDisplayName(donor) }}
                  aria-hidden
                  role={undefined}
                  aria-label={undefined}
                />
                <span className="flex flex-col">
                  <span className="type-body font-bold text-brick">{patientDisplayName(linked)}</span>
                  <span className="type-data text-ink-muted">{linked.hrn}</span>
                </span>
              </button>
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="type-caption -mt-1 text-ink-muted">
        Risk: {patient.riskCategory ? RISK_LABEL[patient.riskCategory] : "Not set"}. Follow-up after year 1: every{" "}
        {patient.followupMonths} {patient.followupMonths === 1 ? "month" : "months"}. Opening this profile is recorded in the activity log.
      </p>
    </header>
  );
}

function Fact({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="type-label text-ink-muted">{term}</dt>
      <dd className="type-body text-ink">{value}</dd>
    </div>
  );
}
