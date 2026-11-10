import { useEffect, useState } from "react";
import { AdminShell, AdminToaster } from "@/components/ktp/admin";
import { CountUp, MotionRoot, OrganGridBackdrop, PageTransition } from "@/components/motion";
import { ADMIN_HREFS } from "@/lib/ktpAdminRoutes";
import { STAGE_ADMIN_LABEL } from "@/lib/ktpLabels";
import { trpc } from "@/lib/trpc";
import { PATIENT_STATUSES, type PatientStatus } from "@shared/ktp";
import { MetricsAnalysis } from "@/components/ktp/admin/MetricsAnalysis";

export default function MetricsPage() {
  const [status, setStatus] = useState<PatientStatus | "All">("Active");
  const metrics = trpc.dashboard.metrics.useQuery(status === "All" ? {} : { status });
  useEffect(() => { document.title = "Metrics | KTP"; }, []);
  const data = metrics.data;
  const cards = data ? [
    ["Total patients", data.total, "Recipients and donors combined"],
    ["Recipients", data.recipients, "Kidney transplant recipient profiles"],
    ["Donors", data.donors, "Living donor profiles"],
    ["For ethics in Clearances", data.forEthics, `${data.ethicsRecipients} recipients · ${data.ethicsDonors} donors. In Clearances with pending Ethics committee review.`],
    ["For kidney transplant", data.forTransplant, "Recipients in Phase 3 pre-admission"],
    ["Post kidney transplant", data.postTransplant, "Recipients in Post-KT"],
    ["Post donation", data.postDonation, "Donors in Post-donation"],
  ] as const : [];
  return (
    <MotionRoot intensity="full">
      <AdminToaster>
        <div data-surface="admin" className="relative isolate min-h-dvh bg-ground text-ink">
          <OrganGridBackdrop />
          <AdminShell current="metrics" hrefs={ADMIN_HREFS} hideUnavailable mobileTitle="Metrics" skipTo="metrics" skipLabel="Skip to metrics">
            <PageTransition routeKey="metrics" focusHeading={false}>
              <main id="metrics" tabIndex={-1} className="mx-auto w-full max-w-[1800px] px-4 pb-16 pt-3 outline-none md:px-6 lg:pt-8">
                <header className="flex flex-wrap items-end justify-between gap-4">
                  <div><h1 className="type-display">Metrics</h1><p className="type-body-sm mt-2 text-ink-muted">Patient and donor counts from current records.</p></div>
                  <label className="type-body-sm flex items-center gap-3">Patient status
                    <select value={status} onChange={e => setStatus(e.target.value as PatientStatus | "All")} className="clay-focus clay-2 min-h-11 cursor-pointer appearance-none rounded-2xl border-0 bg-surface-2 bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2216%22%20height=%2216%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%231e1e1c%22%20stroke-width=%222.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22><path%20d=%22m6%209%206%206%206-6%22/></svg>')] bg-[length:16px] bg-[right_1rem_center] bg-no-repeat py-2 pl-5 pr-11 type-body-sm font-medium text-ink outline-none">
                      <option value="All">All statuses</option>
                      {PATIENT_STATUSES.map(value => <option key={value}>{value}</option>)}
                    </select>
                  </label>
                </header>
                {metrics.isLoading ? <p role="status" className="mt-8">Loading metrics…</p> : metrics.isError ? (
                  <div role="alert" className="mt-8"><p>Could not load metrics.</p><button type="button" onClick={() => metrics.refetch()} className="clay-focus mt-3 rounded-lg border border-hairline px-4 py-2">Try again</button></div>
                ) : data ? <>
                  <p className="type-caption mt-6 text-ink-muted">Scope: {status === "All" ? "all patient statuses" : `${status.toLowerCase()} patients`}. Each profile counts once. Category counts overlap.</p>
                  {data.total === 0 && <p role="status" className="mt-4">No patients match this status.</p>}
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {cards.map(([label, value, description]) => <section key={label} className="clay-1 rounded-2xl bg-surface-1 p-5">
                      <h2 className="type-body-sm font-bold">{label}</h2><p className="type-display mt-3 tabular-nums"><CountUp value={value} /></p><p className="type-caption mt-2 text-ink-muted">{description}</p>
                    </section>)}
                  </div>
                  <section className="mt-6" aria-labelledby="stages-heading">
                    <h2 id="stages-heading" className="type-headline">Patients by stage</h2>
                    <div className="clay-table-wrap mt-4">
                      <table className="clay-table">
                        <thead>
                          <tr>
                            <th scope="col">Stage</th>
                            <th scope="col" className="text-right">Recipients</th>
                            <th scope="col" className="text-right">Donors</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.stages.map(row => (
                            <tr key={row.stage}>
                              <th scope="row" className="font-normal">{STAGE_ADMIN_LABEL[row.stage]}</th>
                              <td data-num="true" className="text-right"><CountUp value={row.recipients} align="end" /></td>
                              <td data-num="true" className="text-right"><CountUp value={row.donors} align="end" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <MetricsAnalysis data={data.analysis} />
                </> : null}
              </main>
            </PageTransition>
          </AdminShell>
        </div>
      </AdminToaster>
    </MotionRoot>
  );
}
