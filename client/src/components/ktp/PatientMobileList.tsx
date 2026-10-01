import { Link } from "wouter";
import type { Patient } from "../../../../drizzle/schema";
import { ClayAvatar } from "@/components/clay";

export function PatientMobileList({
  patients,
  doctors,
}: {
  patients: Patient[];
  doctors: Map<number, string>;
}) {
  return (
    <ul
      className="divide-y divide-hairline md:hidden"
      aria-label="Patient registry"
    >
      {patients.map(patient => (
        <li key={patient.id} className="min-w-0 p-4">
          <Link
            href={`/patients/${patient.id}`}
            className="clay-focus flex min-h-11 min-w-0 items-center gap-3 rounded-md"
          >
            <ClayAvatar
              name={`${patient.firstName} ${patient.lastName}`}
              size={40}
              decorative
            />
            <span className="min-w-0 break-words font-semibold text-brick">
              {patient.lastName}, {patient.firstName} {patient.suffix ?? ""}
            </span>
          </Link>
          <p className="mt-1 break-all type-body-sm text-ink-muted">
            {patient.accountEmail}
          </p>
          <dl className="mt-3 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 type-body-sm">
            <dt className="text-ink-muted">HRN</dt>
            <dd className="min-w-0 break-all font-mono">{patient.hrn}</dd>
            <dt className="text-ink-muted">Type</dt>
            <dd>{patient.patientType}</dd>
            <dt className="text-ink-muted">Stage</dt>
            <dd className="break-words">{patient.stage}</dd>
            <dt className="text-ink-muted">Status</dt>
            <dd>{patient.status}</dd>
            <dt className="text-ink-muted">Nephrologist</dt>
            <dd className="break-words">
              {patient.nephrologistId
                ? (doctors.get(patient.nephrologistId) ?? "Not set")
                : "Not set"}
            </dd>
            <dt className="text-ink-muted">Fellow</dt>
            <dd className="break-words">
              {patient.fellowId
                ? (doctors.get(patient.fellowId) ?? "Not set")
                : "Not set"}
            </dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}
