import { useEffect, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { Link } from "wouter";
import { AdminShell, AdminToaster } from "@/components/ktp/admin";
import { fmtDate } from "@/components/ktp/admin/format";
import { ZBenefitDialog, Z_TYPES, type ZBenefitRow } from "@/components/ktp/admin/ZBenefitDialog";
import { ClayButton, ClayCard, StatusChip } from "@/components/clay";
import { MotionRoot, OrganGridBackdrop, PageTransition } from "@/components/motion";
import { ADMIN_HREFS } from "@/lib/ktpAdminRoutes";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { todayDate, type ServiceType } from "@shared/ktp";
import { zDueState } from "@shared/zBenefit";

/*
 * PhilHealth Z Benefit follow-up. One row for each active recipient, with the dates that the
 * Z Benefit claim needs for medicines, laboratory, tacrolimus test, and X-ray and ultrasound.
 * The values come from the service records of the Tracker. Record dates opens the form where the
 * nurse transcribes them.
 */

const TYPES = Z_TYPES;
const GROUP = Object.fromEntries(Z_TYPES.map(({ type, group }) => [type, group])) as Record<ServiceType, string>;

/** A date that is done. */
function Done({ date }: { date: string | null }) {
  return date ? (
    <span className="type-data whitespace-nowrap text-ink">{fmtDate(date)}</span>
  ) : (
    <span className="type-body-sm text-ink-muted">None</span>
  );
}

/** A date that is due, with a chip when it is overdue or in the next 7 days. */
function Due({ date, today }: { date: string | null; today: string }) {
  if (!date) return <span className="type-body-sm text-ink-muted">None</span>;
  const state = zDueState(date, today);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="type-data whitespace-nowrap text-ink">{fmtDate(date)}</span>
      {state === "overdue" && <StatusChip status="overdue" />}
      {state === "soon" && <StatusChip status="due-soon" />}
    </span>
  );
}

export default function ZBenefitPage() {
  const [search, setSearch] = useState("");
  const [postOnly, setPostOnly] = useState(true);
  const [editing, setEditing] = useState<ZBenefitRow | null>(null);
  const query = trpc.clinical.zBenefit.useQuery();
  const today = todayDate();

  useEffect(() => {
    document.title = "Z Benefit | KTP";
  }, []);

  const term = search.trim().toLowerCase();
  const rows = (query.data ?? []).filter(
    row =>
      (!postOnly || row.stage === "PostKT") &&
      (!term || `${row.lastName}, ${row.firstName} ${row.hrn}`.toLowerCase().includes(term))
  );
  const name = (row: (typeof rows)[number]) =>
    `${row.lastName}, ${row.firstName}${row.suffix ? ` ${row.suffix}` : ""}`;

  return (
    <MotionRoot intensity="full">
      <AdminToaster>
        <div data-surface="admin" className="relative isolate min-h-dvh bg-ground text-ink">
          <OrganGridBackdrop />
          <AdminShell
            current="zBenefit"
            hrefs={ADMIN_HREFS}
            hideUnavailable
            mobileTitle="Z Benefit"
            skipTo="z-benefit-table"
            skipLabel="Skip to the Z Benefit list"
          >
            <PageTransition routeKey="z-benefit" focusHeading={false}>
              <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 md:px-6 lg:px-8 lg:pb-20">
                <header className="pt-3 lg:pt-8">
                  <h1 className="type-display text-ink">Z Benefit</h1>
                  <p className="mt-1 max-w-[68ch] type-body-sm text-ink-muted">
                    Dates for the PhilHealth Z Benefit claim of each recipient. Use Record dates to enter the dates
                    of a patient. The Tracker of the patient shows the same records.
                  </p>
                </header>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <label className="relative min-w-0 flex-1 basis-64">
                    <span className="sr-only">Search by name or HRN</span>
                    <Search
                      aria-hidden
                      strokeWidth={1.75}
                      className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-muted"
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                      placeholder="Search by name or HRN"
                      className="clay-sunken clay-focus h-12 w-full min-w-0 rounded-sm border-[1.5px] border-line-strong pr-3.5 pl-11 type-body text-ink placeholder:text-ink-muted"
                    />
                  </label>
                  <div
                    role="group"
                    aria-label="Show"
                    className="clay-sunken inline-flex gap-2 rounded-full p-1"
                  >
                    {[
                      { label: "Post-KT", value: true },
                      { label: "All recipients", value: false },
                    ].map(option => (
                      <button
                        key={option.label}
                        type="button"
                        aria-pressed={postOnly === option.value}
                        onClick={() => setPostOnly(option.value)}
                        className={cn(
                          "clay-focus-inset min-h-11 cursor-pointer rounded-full px-4 type-button transition-colors duration-(--dur-color)",
                          postOnly === option.value ? "clay-1 bg-surface-2 text-ink" : "text-ink-muted hover:text-ink"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <p role="status" className="mt-4 type-body-sm text-ink-muted">
                  {query.isLoading
                    ? "Loading the Z Benefit list..."
                    : `${rows.length} ${rows.length === 1 ? "recipient" : "recipients"}`}
                </p>

                {query.isError ? (
                  <ClayCard className="mt-3 p-5">
                    <p role="alert">Could not load the Z Benefit list.</p>
                    <ClayButton className="mt-3" onClick={() => query.refetch()}>
                      Retry
                    </ClayButton>
                  </ClayCard>
                ) : !query.isLoading && rows.length === 0 ? (
                  <ClayCard className="mt-3 p-5">
                    <p className="type-body">
                      {postOnly && !term
                        ? "No recipient is in the Post-KT stage. Choose All recipients to see the other stages."
                        : "No recipient matches."}
                    </p>
                  </ClayCard>
                ) : (
                  rows.length > 0 && (
                    <>
                      {/* 1024 px and wider: one table in its own scroll region. */}
                      <ClayCard padding="none" className="mt-3 hidden min-w-0 lg:block">
                        <div
                          id="z-benefit-table"
                          role="region"
                          aria-label="Z Benefit list"
                          tabIndex={0}
                          className="clay-focus-inset overflow-x-auto rounded-[inherit]"
                        >
                          <table className="w-full border-collapse text-left">
                            <thead className="type-label text-ink-muted">
                              <tr className="border-b border-hairline">
                                <th scope="col" rowSpan={2} className="sticky left-0 z-10 bg-surface-1 px-4 py-3 align-bottom">
                                  Patient
                                </th>
                                <th scope="col" rowSpan={2} className="px-3 py-3 align-bottom">Nephrologist</th>
                                <th scope="col" rowSpan={2} className="px-3 py-3 align-bottom">Fellow in charge</th>
                                {TYPES.map(({ type }) => (
                                  <th key={type} scope="colgroup" colSpan={2} className="border-l border-hairline px-3 pt-3 pb-1 text-ink">
                                    {GROUP[type]}
                                  </th>
                                ))}
                                <th scope="colgroup" colSpan={4} className="border-l border-hairline px-3 pt-3 pb-1 text-ink">
                                  Due date of claims
                                </th>
                              </tr>
                              <tr className="border-b-[1.5px] border-line-strong">
                                {TYPES.map(({ type, done, next }) => [
                                  <th key={`${type}-done`} scope="col" className="min-w-32 border-l border-hairline px-3 pt-1 pb-3 align-bottom">{done}</th>,
                                  <th key={`${type}-next`} scope="col" className="min-w-32 px-3 pt-1 pb-3 align-bottom">{next}</th>,
                                ])}
                                {TYPES.map(({ type, claim }, index) => (
                                  <th key={type} scope="col" className={cn("min-w-32 px-3 pt-1 pb-3 align-bottom", index === 0 && "border-l border-hairline")}>
                                    {claim}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-hairline">
                              {rows.map(row => (
                                <tr key={row.patientId} className="align-top hover:bg-row-hover">
                                  <th scope="row" className="sticky left-0 z-10 bg-surface-1 px-4 py-3 text-left font-normal">
                                    <Link
                                      href={`/patients/${row.patientId}?tab=tracker`}
                                      className="clay-focus inline-flex min-h-11 items-center type-body-sm font-bold whitespace-nowrap text-brick"
                                    >
                                      {name(row)}
                                    </Link>
                                    <span className="block type-data text-ink-muted">{row.hrn}</span>
                                    <ClayButton
                                      variant="secondary"
                                      size="sm"
                                      icon={<Pencil strokeWidth={1.75} />}
                                      aria-label={`Record dates: ${name(row)}`}
                                      onClick={() => setEditing(row)}
                                      className="mt-2"
                                    >
                                      Record dates
                                    </ClayButton>
                                  </th>
                                  <td className="px-3 py-3 type-body-sm whitespace-nowrap">{row.nephrologist ?? <span className="text-ink-muted">Not set</span>}</td>
                                  <td className="px-3 py-3 type-body-sm whitespace-nowrap">{row.fellow ?? <span className="text-ink-muted">Not set</span>}</td>
                                  {TYPES.map(({ type }) => [
                                    <td key={`${type}-done`} className="border-l border-hairline px-3 py-3">
                                      <Done date={type === "Meds" ? row.services[type].firstDate : row.services[type].lastDate} />
                                    </td>,
                                    <td key={`${type}-next`} className="px-3 py-3">
                                      <Due date={row.services[type].nextDue} today={today} />
                                    </td>,
                                  ])}
                                  {TYPES.map(({ type }, index) => (
                                    <td key={type} className={cn("px-3 py-3", index === 0 && "border-l border-hairline")}>
                                      <Due date={row.services[type].claimDue} today={today} />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </ClayCard>

                      {/* Under 1024 px: one card for each recipient. */}
                      <ul className="mt-3 space-y-4 lg:hidden">
                        {rows.map(row => (
                          <li key={row.patientId}>
                            <ClayCard className="min-w-0">
                              <Link
                                href={`/patients/${row.patientId}?tab=tracker`}
                                className="clay-focus inline-flex min-h-11 items-center type-title break-words text-brick"
                              >
                                {name(row)}
                              </Link>
                              <p className="type-data text-ink-muted">{row.hrn}</p>
                              <ClayButton
                                variant="secondary"
                                size="sm"
                                icon={<Pencil strokeWidth={1.75} />}
                                aria-label={`Record dates: ${name(row)}`}
                                onClick={() => setEditing(row)}
                                className="mt-2"
                              >
                                Record dates
                              </ClayButton>
                              <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 type-body-sm">
                                <dt className="text-ink-muted">Nephrologist</dt>
                                <dd>{row.nephrologist ?? "Not set"}</dd>
                                <dt className="text-ink-muted">Fellow in charge</dt>
                                <dd>{row.fellow ?? "Not set"}</dd>
                              </dl>
                              {TYPES.map(({ type, done, next, claim }) => (
                                <dl key={type} className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-t border-hairline pt-3 type-body-sm">
                                  <dt className="text-ink-muted">{done}</dt>
                                  <dd><Done date={type === "Meds" ? row.services[type].firstDate : row.services[type].lastDate} /></dd>
                                  <dt className="text-ink-muted">{next}</dt>
                                  <dd><Due date={row.services[type].nextDue} today={today} /></dd>
                                  <dt className="text-ink-muted">Due date of claim ({claim})</dt>
                                  <dd><Due date={row.services[type].claimDue} today={today} /></dd>
                                </dl>
                              ))}
                            </ClayCard>
                          </li>
                        ))}
                      </ul>
                    </>
                  )
                )}
                <ZBenefitDialog row={editing} onClose={() => setEditing(null)} />
              </main>
            </PageTransition>
          </AdminShell>
        </div>
      </AdminToaster>
    </MotionRoot>
  );
}
