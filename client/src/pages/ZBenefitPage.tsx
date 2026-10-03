import { useEffect, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { Link } from "wouter";
import { AdminShell, AdminToaster } from "@/components/ktp/admin";
import { fmtDateCell } from "@/components/ktp/admin/format";
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

/*
 * The table needs about 950 px for its 14 columns. The width that the list gets does not follow
 * the width of the screen (the sidebar is 80 px or 264 px), so the switch between the table and
 * the cards is a container query, not a screen breakpoint.
 */
const TABLE_FITS = { table: "@min-[960px]:block", cards: "@min-[960px]:hidden" };
/** In the table, a status chip is the word only and can break onto two lines. */
const DENSE_CHIPS =
  "[&_[data-status]]:h-auto [&_[data-status]]:min-h-6 [&_[data-status]]:rounded-md [&_[data-status]]:px-1.5 [&_[data-status]]:py-0.5 [&_[data-status]]:whitespace-normal [&_[data-status]_svg]:hidden";

/** Short column headings for the table. The full label stays as the tooltip and the screen-reader name. */
const shortDone = (type: ServiceType) => (type === "Meds" ? "First claim" : "Date");
const shortClaim = (type: ServiceType, claim: string) => (type === "Laboratory" ? "Lab" : claim);

function Heading({ short, full }: { short: string; full: string }) {
  return (
    <>
      <span aria-hidden title={full}>{short}</span>
      <span className="sr-only">{full}</span>
    </>
  );
}

/** A date that is done. */
function Done({ date }: { date: string | null }) {
  return date ? (
    <span className="block type-data text-ink">{fmtDateCell(date)}</span>
  ) : (
    <span className="type-body-sm text-ink-muted">None</span>
  );
}

/** A date that is due, with a chip when it is overdue or in the next 7 days. */
function Due({ date, today }: { date: string | null; today: string }) {
  if (!date) return <span className="type-body-sm text-ink-muted">None</span>;
  const state = zDueState(date, today);
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="type-data text-ink">{fmtDateCell(date)}</span>
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
              <main className="mx-auto w-full max-w-[1800px] px-4 pb-16 md:px-6 lg:pb-20">
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
                    <div className="@container mt-3">
                      {/* Room for all columns: one table. A date breaks before the year and a chip is the word only, so nothing scrolls sideways. */}
                      <ClayCard padding="none" className={cn("hidden min-w-0", TABLE_FITS.table)}>
                        <div
                          id="z-benefit-table"
                          role="region"
                          aria-label="Z Benefit list"
                          tabIndex={0}
                          className="clay-focus-inset show-scrollbar-x overflow-x-auto rounded-[inherit]"
                        >
                          <table className={cn("w-full border-collapse text-left", DENSE_CHIPS)}>
                            <thead className="type-label text-ink-muted">
                              <tr className="border-b border-hairline">
                                <th scope="col" rowSpan={2} className="w-56 px-2 py-2 align-bottom">
                                  Patient
                                </th>
                                {TYPES.map(({ type }) => (
                                  <th key={type} scope="colgroup" colSpan={2} className="border-l border-hairline px-1 pt-2 pb-1 text-ink">
                                    {GROUP[type]}
                                  </th>
                                ))}
                                <th scope="colgroup" colSpan={4} className="border-l border-hairline px-1 pt-2 pb-1 text-ink">
                                  Due date of claims
                                </th>
                                <th scope="col" rowSpan={2} className="border-l border-hairline px-1.5 py-2 align-bottom">
                                  Record dates
                                </th>
                              </tr>
                              <tr className="border-b-[1.5px] border-line-strong">
                                {TYPES.map(({ type, done, next }) => [
                                  <th key={`${type}-done`} scope="col" className="border-l border-hairline px-1 pt-1 pb-2 align-bottom">
                                    <Heading short={shortDone(type)} full={done} />
                                  </th>,
                                  <th key={`${type}-next`} scope="col" className="px-1 pt-1 pb-2 align-bottom">
                                    <Heading short="Next due" full={next} />
                                  </th>,
                                ])}
                                {TYPES.map(({ type, claim }, index) => (
                                  <th key={type} scope="col" className={cn("px-1 pt-1 pb-2 align-bottom", index === 0 && "border-l border-hairline")}>
                                    <Heading short={shortClaim(type, claim)} full={`Due date of claim (${claim})`} />
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            {/* One group of two rows for each recipient: the dates, then the doctors on one line under the dates. */}
                            {rows.map(row => (
                              <tbody key={row.patientId} className="border-t border-hairline align-top hover:bg-row-hover">
                                <tr>
                                  <th scope="rowgroup" rowSpan={2} className="px-2 py-2 text-left font-normal">
                                    <Link
                                      href={`/patients/${row.patientId}?tab=tracker`}
                                      className="clay-focus inline-flex min-h-11 items-center type-body-sm font-bold text-brick"
                                    >
                                      {name(row)}
                                    </Link>
                                    <span className="block type-data whitespace-nowrap text-ink-muted">{row.hrn}</span>
                                  </th>
                                  {TYPES.map(({ type }) => [
                                    <td key={`${type}-done`} className="border-l border-hairline px-1 pt-2 pb-1">
                                      <Done date={type === "Meds" ? row.services[type].firstDate : row.services[type].lastDate} />
                                    </td>,
                                    <td key={`${type}-next`} className="px-1 pt-2 pb-1">
                                      <Due date={row.services[type].nextDue} today={today} />
                                    </td>,
                                  ])}
                                  {TYPES.map(({ type }, index) => (
                                    <td key={type} className={cn("px-1 pt-2 pb-1", index === 0 && "border-l border-hairline")}>
                                      <Due date={row.services[type].claimDue} today={today} />
                                    </td>
                                  ))}
                                  <td rowSpan={2} className="border-l border-hairline px-1.5 py-2">
                                    <ClayButton
                                      variant="icon"
                                      size="sm"
                                      title="Record dates"
                                      aria-label={`Record dates: ${name(row)}`}
                                      onClick={() => setEditing(row)}
                                    >
                                      <Pencil strokeWidth={1.75} />
                                    </ClayButton>
                                  </td>
                                </tr>
                                <tr>
                                  <td colSpan={12} className="border-l border-hairline px-1 pb-2 type-caption text-ink-muted">
                                    <span className="mr-4 inline-block">Nephrologist: {row.nephrologist ?? "Not set"}</span>
                                    <span className="inline-block">Fellow in charge: {row.fellow ?? "Not set"}</span>
                                  </td>
                                </tr>
                              </tbody>
                            ))}
                          </table>
                        </div>
                      </ClayCard>

                      {/* Not enough room for the table: one card for each recipient. */}
                      <ul className={cn("space-y-4", TABLE_FITS.cards)}>
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
                              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 type-body-sm">
                                <dt className="text-ink-muted">Nephrologist</dt>
                                <dd className="text-right">{row.nephrologist ?? "Not set"}</dd>
                                <dt className="text-ink-muted">Fellow in charge</dt>
                                <dd className="text-right">{row.fellow ?? "Not set"}</dd>
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
                    </div>
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
