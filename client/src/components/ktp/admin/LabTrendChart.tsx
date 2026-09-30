import { useId, useMemo, useState } from "react";
import { ChartLine, Table2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { ClayCard, ClayCardEmpty, ClayCardError, ClayTabs, ClayTabsList, ClayTabsTrigger, StatusChip } from "@/components/clay";
import { LayoutGroup, MotionClayButton, PILL_IDS, SHARED_PILL_HOST, SharedPill, SheenSkeleton, useChartMotion } from "@/components/motion";
import { labSeries, type LabFlag, type LabPoint, type LabTest, type MockDataset } from "@/pages/preview/mock";
import { cn } from "@/lib/utils";
import { fmtDate, fmtTick } from "./format";
import { rangeText } from "./serviceRules";
import { LabValuesTable } from "./LabValuesTable";

/*
 * Lab trend card (DESIGN.md Colors, chart series; Motion, chart draw-in). Single series in forest on
 * a sage-tint reference band; High points are plum up-triangles, Low points blue down-triangles.
 * Superseded results never reach the chart. The figure carries a text summary and a real table
 * sits behind "Show as table".
 */

export const FLAG_CHIP: Record<LabFlag, "lab-low" | "lab-normal" | "lab-high"> = {
  Low: "lab-low",
  Normal: "lab-normal",
  High: "lab-high",
};
/** Chart summary and tooltip wording (COPY labs.chart.aria sample). */
const FLAG_WORDS: Record<LabFlag, string> = { Low: "Below range", Normal: "In range", High: "Above range" };

export interface LabTrendChartProps {
  patientId: string;
  tests: LabTest[];
  data: MockDataset;
  state?: "ready" | "loading" | "error" | "empty";
  onRetry?: () => void;
  headingLevel?: "h2" | "h3";
}

interface ChartPoint extends LabPoint {
  tick: string;
}

export function LabTrendChart({ patientId, tests, data, state = "ready", onRetry, headingLevel: H = "h2" }: LabTrendChartProps) {
  const [testId, setTestId] = useState(tests[0]?.id ?? "");
  const [view, setView] = useState<"chart" | "table">("chart");
  const titleId = useId();
  const viewId = useId();
  const test = tests.find((t) => t.id === testId) ?? tests[0];
  const series = useMemo(() => (test ? labSeries(patientId, test.id, data) : null), [patientId, test, data]);
  const points = state === "empty" ? [] : (series?.points ?? []);
  const latest = points.at(-1) ?? null;

  if (!test) return null;

  return (
    <ClayCard role="region" aria-labelledby={titleId} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <H id={titleId} className="type-title text-ink">{test.name} trend</H>
          <p className="type-body-sm mt-1 text-ink-muted">
            {test.low === null && test.high === null
              ? "No range set. Flags are off for this test."
              : `Reference range ${rangeText(test)} ${test.unit}`}
          </p>
        </div>
      </div>

      <LayoutGroup id="lab-tests">
        <ClayTabs value={test.id} onValueChange={setTestId}>
          <ClayTabsList aria-label="Test" className="w-full sm:w-fit">
            {tests.map((t) => (
              <ClayTabsTrigger key={t.id} value={t.id} className={cn(SHARED_PILL_HOST, "flex-1 sm:flex-none")}>
                {t.id === test.id ? <SharedPill id={PILL_IDS.tab} /> : null}
                {t.name}
              </ClayTabsTrigger>
            ))}
          </ClayTabsList>
        </ClayTabs>
      </LayoutGroup>

      {state === "loading" ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">Loading results...</span>
          <SheenSkeleton className="h-8 w-40" />
          <SheenSkeleton className="h-52" />
        </div>
      ) : state === "error" ? (
        <ClayCardError message="Could not reach the server. Check the connection and retry." onRetry={onRetry} />
      ) : !latest ? (
        <ClayCardEmpty message={`No results yet for ${test.name}.`} />
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-baseline gap-1">
              <span className="type-data-lg text-ink">{latest.value}</span>
              <span className="type-body-sm text-ink-muted">{test.unit}</span>
            </span>
            {latest.flag ? <StatusChip status={FLAG_CHIP[latest.flag]} srContext="Latest result:" /> : null}
            <span className="type-data text-ink-muted">{fmtDate(latest.date)}</span>
          </p>
          <div id={viewId}>
            {view === "chart" ? (
              <TrendFigure key={test.id} test={test} points={points} />
            ) : (
              <LabValuesTable patientId={patientId} tests={[test]} data={data} caption={`${test.name} results`} />
            )}
          </div>
          <div>
            <MotionClayButton
              variant="ghost"
              size="sm"
              className="-ml-2"
              aria-controls={viewId}
              icon={view === "chart" ? <Table2 strokeWidth={1.75} /> : <ChartLine strokeWidth={1.75} />}
              onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
            >
              {view === "chart" ? "Show as table" : "Show as chart"}
            </MotionClayButton>
          </div>
        </>
      )}
    </ClayCard>
  );
}

function TrendFigure({ test, points }: { test: LabTest; points: LabPoint[] }) {
  const chart = useChartMotion();
  const captionId = useId();
  const rows: ChartPoint[] = points.map((p) => ({ ...p, tick: fmtTick(p.date) }));
  const values = points.map((p) => p.value);
  const lo = Math.min(...values, test.low ?? Number.POSITIVE_INFINITY);
  const hi = Math.max(...values, test.high ?? Number.NEGATIVE_INFINITY);
  const { domain, ticks } = niceScale(lo, hi);
  const first = points[0];
  const last = points[points.length - 1];
  const summary = `Line chart of ${test.name}: ${points.length} results from ${fmtDate(first.date)} to ${fmtDate(last.date)}. Latest ${last.value} ${test.unit}, ${last.flag ? FLAG_WORDS[last.flag] : "No range set"}.`;

  return (
    <figure aria-labelledby={captionId} className="flex flex-col gap-3">
      <div aria-hidden className="h-56 w-full sm:h-60">
        <p className="type-caption mb-1 text-ink-muted">{test.unit}</p>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={rows} margin={{ top: 8, right: 22, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            {test.low !== null && test.high !== null ? (
              <ReferenceArea y1={test.low} y2={test.high} fill="var(--sage-tint)" fillOpacity={1} className={chart.bandClassName} ifOverflow="extendDomain" />
            ) : null}
            <XAxis
              dataKey="tick"
              tick={{ fontSize: 12, fill: "var(--ink-muted)", fontFamily: "var(--ff-data)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--line-strong)", strokeWidth: 1.5 }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              domain={domain}
              width={44}
              tick={{ fontSize: 12, fill: "var(--ink-muted)", fontFamily: "var(--ff-data)" }}
              tickLine={false}
              axisLine={false}
              ticks={ticks}
            />
            <Tooltip
              cursor={{ stroke: "var(--line-strong)", strokeDasharray: "4 4" }}
              content={<ChartTooltip unit={test.unit} />}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke="var(--series-2)"
              strokeWidth={2.5}
              {...chart.line}
              activeDot={{ r: 6, fill: "var(--series-2)", stroke: "var(--surface-1)", strokeWidth: 2 }}
              dot={(p: { cx?: number; cy?: number; index: number; payload?: ChartPoint }) => (
                <g key={p.index} {...chart.point(p.index)}>
                  <Marker cx={p.cx ?? 0} cy={p.cy ?? 0} flag={p.payload?.flag ?? null} />
                </g>
              )}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption id={captionId} className="flex flex-col gap-2">
        <span className="type-body-sm flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-muted" aria-hidden>
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="4.5" fill="var(--series-2)" /></svg>
            Result
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1.5 13 12.5H1Z" fill="var(--lab-high)" /></svg>
            Out of range
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded-[3px] bg-sage-tint" />
            Reference range
          </span>
        </span>
        <span className="type-caption text-ink-muted">
          <span className="sr-only">{summary} </span>
          Superseded results are not charted.
        </span>
      </figcaption>
    </figure>
  );
}

/** Round axis: about 4 steps of 1, 2, 2.5, or 5 times a power of ten. */
function niceScale(lo: number, hi: number): { domain: [number, number]; ticks: number[] } {
  const span = Math.max(hi - lo, 1e-6);
  const raw = span / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((st) => st >= raw) ?? 10 * pow;
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(+v.toFixed(2));
  return { domain: [min, max], ticks };
}

function Marker({ cx, cy, flag }: { cx: number; cy: number; flag: LabFlag | null }) {
  if (flag === "High") return <path d={`M${cx} ${cy - 7}L${cx + 6.5} ${cy + 4.5}H${cx - 6.5}Z`} fill="var(--lab-high)" stroke="var(--surface-1)" strokeWidth={1.5} strokeLinejoin="round" />;
  if (flag === "Low") return <path d={`M${cx} ${cy + 7}L${cx + 6.5} ${cy - 4.5}H${cx - 6.5}Z`} fill="var(--lab-low)" stroke="var(--surface-1)" strokeWidth={1.5} strokeLinejoin="round" />;
  return <circle cx={cx} cy={cy} r={4.5} fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth={2} />;
}

function ChartTooltip({ active, payload, unit }: TooltipProps<number, string> & { unit: string }) {
  const point = active ? (payload?.[0]?.payload as ChartPoint | undefined) : undefined;
  if (!point) return null;
  return (
    <div className="type-body-sm rounded-xs bg-ink px-3 py-2 text-on-brick">
      <span className="type-data">{fmtDate(point.date)}</span>: {point.value} {unit}, {point.flag ? FLAG_WORDS[point.flag] : "No range set"}
    </div>
  );
}
