import { StatusChip } from "@/components/clay";
import { labSeries, type LabFlag, type LabTest, type MockDataset } from "@/pages/preview/mock";
import { fmtDate } from "./format";
import { REPEAT_REASON_LABEL } from "./TriageLists";

/*
 * Lab values table (flat data, DESIGN.md Flat Data Rule). Newest first. Superseded results stay
 * visible in grey with the value struck through and the reason they are left out of the chart.
 */

const FLAG_CHIP: Record<LabFlag, "lab-low" | "lab-normal" | "lab-high"> = {
  Low: "lab-low",
  Normal: "lab-normal",
  High: "lab-high",
};

export interface LabValuesTableProps {
  patientId: string;
  tests: LabTest[];
  data: MockDataset;
  caption: string;
}

export function LabValuesTable({ patientId, tests, data, caption }: LabValuesTableProps) {
  const records = new Map(data.serviceRecords.map((r) => [r.id, r]));
  const rows = tests
    .flatMap((test) => (labSeries(patientId, test.id, data, { includeSuperseded: true })?.points ?? []).map((p) => ({ test, p })))
    .sort((a, b) => (a.p.date === b.p.date ? a.test.sortOrder - b.test.sortOrder : a.p.date < b.p.date ? 1 : -1));
  const multi = tests.length > 1;

  return (
    <div role="region" aria-label={caption} tabIndex={0} className="clay-table-wrap clay-focus -mx-2 max-h-[420px]">
      <table className="clay-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" data-sticky="true">Date</th>
            {multi ? <th scope="col">Test</th> : null}
            <th scope="col" className="text-right!">Value</th>
            <th scope="col">Flag</th>
            <th scope="col">Service record</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ test, p }) => {
            const record = records.get(p.recordId);
            const repeatOf = record?.repeatOfId ? records.get(record.repeatOfId) : undefined;
            const replacement = p.superseded ? data.serviceRecords.find((r) => r.repeatOfId === p.recordId) : undefined;
            return (
              <tr key={p.resultId} data-superseded={p.superseded || undefined}>
                <th scope="row" data-sticky="true" data-num="true" className="font-normal">
                  {fmtDate(p.date)}
                </th>
                {multi ? <td>{test.name}</td> : null}
                <td data-num="true" className="text-right">
                  <span className={p.superseded ? "clay-struck" : undefined}>{p.value}</span>{" "}
                  <span className="text-ink-muted">{test.unit}</span>
                </td>
                <td>
                  {p.superseded ? (
                    <StatusChip status="superseded" />
                  ) : p.flag ? (
                    <StatusChip status={FLAG_CHIP[p.flag]} />
                  ) : (
                    <span className="text-ink-muted">No range</span>
                  )}
                </td>
                <td className="whitespace-normal! min-w-56 py-2">
                  <span className="block">{record?.label ?? "Not set"}</span>
                  {p.superseded ? (
                    <span className="type-caption block text-superseded">
                      Superseded by the repeat on {fmtDate(replacement?.serviceDate ?? p.date)}. Left out of trends and flags.
                    </span>
                  ) : repeatOf && record?.repeatReason ? (
                    <span className="type-caption block text-ink-muted">
                      Repeat of {fmtDate(repeatOf.serviceDate)}. Reason: {REPEAT_REASON_LABEL[record.repeatReason]}.
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
