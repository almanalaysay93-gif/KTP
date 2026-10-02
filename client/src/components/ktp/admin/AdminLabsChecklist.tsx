import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileUp, Plus } from "lucide-react";
import { ClayButton } from "@/components/clay";
import { cn } from "@/lib/utils";
import type { LabPhase } from "@shared/ktp";
import type { ClinicalData } from "./PatientClinicalTabs";
import { ChecklistItemRow } from "./ChecklistItemRow";
import { groupEntries, resultsForItem } from "./labCatalogMeta";
import { OtherResultRow, Progress, Section } from "./LabsSection";
import { LabResultsDialog, type LabDialogStart } from "./LabResultsDialog";

/*
 * Labs tab of the patient profile (DESIGN.md Screens 5). One section for each work-up phase, one
 * for the items with no phase, and one for the lab results that no checklist row shows. Inside a
 * section, the tests of one laboratory panel share a sub-heading and each test has one row.
 * A value typed in a row stays in the row until the user saves it in the result dialog.
 */

type Item = ClinicalData["checklist"][number];
type Drafts = Record<number, string>;

const count = (items: Item[]) =>
  items.filter(item => item.status === "Done").length;
const applicableCount = (items: Item[]) =>
  items.filter(item => item.status !== "NA").length;

export function AdminLabsChecklist({
  patientId,
  data,
  patient,
}: {
  patientId: number;
  data: ClinicalData;
  patient?: {
    patientType?: string;
    stage?: string;
    surgeryDate?: string | Date | null;
  };
}) {
  const stage = patient?.stage ?? "";
  const afterSurgery = stage.startsWith("Post");
  const heading = useRef<HTMLHeadingElement>(null);
  // Items that were pending when the filter was set. A row stays in view after the user completes it.
  const [pendingIds, setPendingIds] = useState<Set<number> | null>(null);
  const pendingOnly = pendingIds !== null;
  // The section that matches the stage of the patient starts open.
  const [openKeys, setOpenKeys] = useState<Set<string>>(
    () =>
      new Set([
        /^Phase[123]$/.test(stage)
          ? stage
          : afterSurgery
            ? "results"
            : "general",
      ])
  );
  const [drafts, setDrafts] = useState<Drafts>({});
  const [dialog, setDialog] = useState<LabDialogStart | null>(null);

  const checklist = data.checklist;
  const testByName = new Map(data.labTests.map(test => [test.name, test]));
  const shown = new Set(
    checklist.flatMap(item =>
      resultsForItem(item, data.labResults).map(result => result.id)
    )
  );
  const otherResults = data.labResults.filter(result => !shown.has(result.id));
  const otherTests = Array.from(
    new Set(otherResults.map(result => result.testName))
  );
  const startPhase: LabPhase | undefined = afterSurgery
    ? patient?.patientType === "Donor"
      ? "PostDonation"
      : "PostKT"
    : undefined;

  const toggle = (key: string) =>
    setOpenKeys(current => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const clearDrafts = (ids: number[]) =>
    setDrafts(current => {
      const next = { ...current };
      for (const id of ids) delete next[id];
      return next;
    });

  const sections = [1, 2, 3]
    .map(number => ({
      key: `Phase${number}`,
      title: `Phase ${number}`,
      phase: `Phase${number}` as LabPhase,
      items: checklist.filter(item => item.phase === number),
    }))
    .filter(section => section.items.length > 0);
  const general = checklist.filter(item => item.phase === null);

  const renderItems = (items: Item[], phase?: LabPhase) => {
    const visible = pendingIds
      ? items.filter(item => pendingIds.has(item.catalogId))
      : items;
    if (visible.length === 0)
      return (
        <p className="border-t border-hairline px-5 py-4 type-body-sm text-ink-muted">
          No pending items in this section.
        </p>
      );
    return groupEntries(visible).map(({ group, entries }) => (
      <div key={group} role="group" aria-label={group}>
        <h4 className="border-y border-hairline bg-sunken/50 px-4 py-2 type-label text-ink-muted sm:px-5">
          {group}
        </h4>
        <ul className="divide-y divide-hairline">
          {entries.map(item => {
            const test = phase ? testByName.get(item.name) : undefined;
            return (
              <ChecklistItemRow
                key={item.catalogId}
                patientId={patientId}
                item={item}
                unit={test?.unit}
                results={resultsForItem(item, data.labResults)}
                history={data.labResults.filter(
                  result => result.testName === item.name
                )}
                draft={test ? (drafts[test.id] ?? "") : ""}
                onDraft={
                  test
                    ? value =>
                        setDrafts(current => ({ ...current, [test.id]: value }))
                    : undefined
                }
              />
            );
          })}
        </ul>
      </div>
    ));
  };

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 ref={heading} tabIndex={-1} className="clay-focus type-headline">
            Labs and work-up
          </h2>
          <p className="mt-1 type-body-sm text-ink-muted">
            Each test has one row. Type new values in a phase, then review and
            save them together.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ClayButton
            variant="secondary"
            size="sm"
            icon={<Plus strokeWidth={1.75} />}
            onClick={() => setDialog({ phase: startPhase })}
          >
            Add results
          </ClayButton>
          <ClayButton
            variant="secondary"
            size="sm"
            icon={<FileUp strokeWidth={1.75} />}
            onClick={() => setDialog({ phase: startPhase, upload: true })}
          >
            Fill from lab file
          </ClayButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Progress
          done={count(checklist)}
          total={applicableCount(checklist)}
          label="Checklist"
          wide
        />
        <div
          role="group"
          aria-label="Show"
          className="clay-sunken inline-flex gap-2 rounded-full p-1"
        >
          {[
            { label: "All items", value: false },
            { label: "Pending only", value: true },
          ].map(option => (
            <button
              key={option.label}
              type="button"
              aria-pressed={pendingOnly === option.value}
              onClick={() =>
                setPendingIds(
                  option.value
                    ? new Set(
                        checklist
                          .filter(item => item.status === "Pending")
                          .map(item => item.catalogId)
                      )
                    : null
                )
              }
              className={cn(
                "clay-focus-inset min-h-11 cursor-pointer rounded-full px-4 type-button transition-colors duration-(--dur-color)",
                pendingOnly === option.value
                  ? "clay-1 bg-surface-2 text-ink"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {general.length > 0 && (
        <Section
          title="Milestones and clearances"
          open={openKeys.has("general")}
          onToggle={() => toggle("general")}
          summary={
            <Progress done={count(general)} total={applicableCount(general)} />
          }
        >
          {renderItems(general)}
        </Section>
      )}

      {sections.map(section => {
        const typed = section.items.flatMap(item => {
          const test = testByName.get(item.name);
          const value = test ? (drafts[test.id] ?? "").trim() : "";
          return test && value ? [{ labTestId: test.id, value }] : [];
        });
        return (
          <Section
            key={section.key}
            title={section.title}
            open={openKeys.has(section.key)}
            onToggle={() => toggle(section.key)}
            summary={
              <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
                {typed.length > 0 && (
                  <span className="rounded-full bg-peach-tint px-2.5 py-1 type-label text-ink">
                    <span className="type-data font-semibold">
                      {typed.length}
                    </span>{" "}
                    not saved
                  </span>
                )}
                <Progress
                  done={count(section.items)}
                  total={applicableCount(section.items)}
                />
              </span>
            }
            columns={section.items.some(item => testByName.has(item.name))}
            footer={
              typed.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="clay-2 sticky bottom-3 z-10 mx-3 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-3"
                >
                  <p role="status" className="type-body-sm">
                    <span className="type-data font-semibold">
                      {typed.length}
                    </span>{" "}
                    new {typed.length === 1 ? "value" : "values"} in{" "}
                    {section.title}, not saved
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <ClayButton
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        clearDrafts(typed.map(row => row.labTestId))
                      }
                    >
                      Clear
                    </ClayButton>
                    <ClayButton
                      size="sm"
                      onClick={() =>
                        setDialog({ phase: section.phase, rows: typed })
                      }
                    >
                      Review and save
                    </ClayButton>
                  </div>
                </motion.div>
              )
            }
          >
            {renderItems(section.items, section.phase)}
          </Section>
        );
      })}

      <Section
        title="Other lab results"
        open={openKeys.has("results")}
        onToggle={() => toggle("results")}
        summary={
          <span className="type-data text-ink-muted">
            {otherResults.length}{" "}
            {otherResults.length === 1 ? "result" : "results"}
          </span>
        }
      >
        {otherTests.length === 0 ? (
          <p className="border-t border-hairline px-5 py-4 type-body-sm text-ink-muted">
            No other results. Results after surgery and results from Tracker
            show here. Use Add results to save one.
          </p>
        ) : (
          <ul className="divide-y divide-hairline border-t border-hairline">
            {otherTests.map(name => (
              <OtherResultRow
                key={name}
                patientId={patientId}
                name={name}
                results={otherResults.filter(
                  result => result.testName === name
                )}
              />
            ))}
          </ul>
        )}
      </Section>

      <LabResultsDialog
        start={dialog}
        onClose={() => setDialog(null)}
        onSaved={clearDrafts}
        patientId={patientId}
        patientType={patient?.patientType}
        labTests={data.labTests}
        fallbackFocus={heading}
      />
    </div>
  );
}
