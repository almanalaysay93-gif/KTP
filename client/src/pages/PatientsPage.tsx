import { useEffect, useState } from "react";
import { Plus, Search, Filter, ArrowUpDown } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  AdminShell,
  AdminToaster,
  BellButton,
  useAdminToast,
} from "@/components/ktp/admin";
import { ClayAvatar, ClayButton, ClayCard, ClayInput, StatusChip } from "@/components/clay";
import { MotionClayButton, MotionRoot, OrganGridBackdrop, PageTransition } from "@/components/motion";
import { trpc } from "@/lib/trpc";
import { type PatientType, type PatientStatus, PATIENT_TYPES, PATIENT_STATUSES } from "@shared/ktp";

const ADMIN_HREFS = {
  dashboard: "/dashboard",
  patients: "/patients",
  calendar: "/calendar",
  messages: "/messages",
  settings: "/settings",
} as const;

export default function PatientsPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("Active");

  const patientsQuery = trpc.patients.list.useQuery({
    type: typeFilter === "all" ? undefined : (typeFilter as PatientType),
    status: statusFilter === "all" ? undefined : (statusFilter as PatientStatus),
    search: search.trim() || undefined,
  });

  const doctorsQuery = trpc.doctors.list.useQuery();
  const doctorsMap = new Map((doctorsQuery.data ?? []).map((d) => [d.id, d.name]));

  useEffect(() => {
    document.title = "Patients | KTP";
  }, []);

  const patients = patientsQuery.data ?? [];

  return (
    <MotionRoot intensity="full">
      <AdminToaster>
        <div data-surface="admin" className="relative isolate min-h-dvh bg-ground text-ink">
          <OrganGridBackdrop />
          <AdminShell
            current="patients"
            hrefs={ADMIN_HREFS}
            mobileTitle="Patients"
            skipTo="patients-table"
            skipLabel="Skip to patients list"
            mobileActions={
              <MotionClayButton
                variant="icon"
                size="sm"
                aria-label="Enroll patient"
                onClick={() => navigate("/patients/new")}
              >
                <Plus strokeWidth={1.75} />
              </MotionClayButton>
            }
          >
            <PageTransition routeKey="patients" focusHeading={false}>
              <main className="mx-auto w-full max-w-[1120px] px-4 pb-16 md:px-6 lg:px-8 lg:pb-20">
                <header className="flex flex-col gap-4 pt-3 lg:flex-row lg:items-end lg:justify-between lg:pt-8">
                  <div>
                    <h1 className="type-display text-ink">Patients</h1>
                    <p className="type-body-sm text-ink-muted">
                      {patients.length} enrolled {patients.length === 1 ? "record" : "records"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <ClayButton
                      variant="primary"
                      icon={<Plus strokeWidth={1.75} />}
                      onClick={() => navigate("/patients/new")}
                    >
                      Enroll patient
                    </ClayButton>
                  </div>
                </header>

                {/* Filters and Search Bar */}
                <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-surface-1 p-3">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                    <input
                      type="text"
                      placeholder="Search by name or HRN..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-md border border-hairline bg-surface-2 py-2 pl-9 pr-3 type-body-sm text-ink outline-none focus:border-olive"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body-sm text-ink outline-none"
                    >
                      <option value="all">All types</option>
                      <option value="Recipient">Recipient</option>
                      <option value="Donor">Donor</option>
                    </select>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="rounded-md border border-hairline bg-surface-2 px-3 py-2 type-body-sm text-ink outline-none"
                    >
                      <option value="all">All statuses</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Deceased">Deceased</option>
                      <option value="Transferred">Transferred</option>
                    </select>
                  </div>
                </div>

                {/* Patient Table */}
                <div id="patients-table" className="mt-6 overflow-hidden rounded-2xl border border-hairline bg-surface-1">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-hairline bg-surface-2 text-ink-muted type-label">
                          <th className="px-4 py-3">Patient</th>
                          <th className="px-4 py-3">HRN</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Stage</th>
                          <th className="px-4 py-3">Nephrologist</th>
                          <th className="px-4 py-3">Fellow</th>
                          <th className="px-4 py-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        {patientsQuery.isLoading ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-ink-muted type-body-sm">
                              Loading patient registry...
                            </td>
                          </tr>
                        ) : patients.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-ink-muted">
                              <p className="type-headline">No patients found</p>
                              <p className="mt-1 type-body-sm">Try adjusting your search or filters.</p>
                            </td>
                          </tr>
                        ) : (
                          patients.map((patient) => {
                            const nephrologist = patient.nephrologistId
                              ? doctorsMap.get(patient.nephrologistId) ?? "—"
                              : "—";
                            const fellow = patient.fellowId
                              ? doctorsMap.get(patient.fellowId) ?? "—"
                              : "—";

                            return (
                              <tr
                                key={patient.id}
                                onClick={() => navigate(`/patients/${patient.id}`)}
                                className="cursor-pointer transition-colors hover:bg-surface-2/60"
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <ClayAvatar
                                      name={`${patient.firstName} ${patient.lastName}`}
                                      size={40}
                                    />
                                    <div>
                                      <p className="font-semibold text-ink type-body">
                                        {patient.lastName}, {patient.firstName} {patient.suffix ?? ""}
                                      </p>
                                      <p className="text-ink-muted type-body-sm">{patient.accountEmail}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono text-ink-muted type-body-sm">
                                  {patient.hrn}
                                </td>
                                <td className="px-4 py-3 text-ink type-body-sm">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 type-label ${
                                      patient.patientType === "Recipient"
                                        ? "bg-brick-tint text-brick"
                                        : "bg-olive-tint text-olive"
                                    }`}
                                  >
                                    {patient.patientType}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-medium text-ink type-body-sm">
                                  {patient.stage}
                                </td>
                                <td className="px-4 py-3 text-ink-muted type-body-sm">{nephrologist}</td>
                                <td className="px-4 py-3 text-ink-muted type-body-sm">{fellow}</td>
                                <td className="px-4 py-3 text-right">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 type-label ${
                                      patient.status === "Active"
                                        ? "bg-olive-tint text-olive"
                                        : "bg-ink-muted/10 text-ink-muted"
                                    }`}
                                  >
                                    {patient.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </main>
            </PageTransition>
          </AdminShell>
        </div>
      </AdminToaster>
    </MotionRoot>
  );
}
