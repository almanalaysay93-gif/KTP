import { ClayInput, StatusChip } from "@/components/clay";

export interface NurseApprovalCardProps {
  requireApproval: boolean;
  setRequireApproval: (value: boolean) => void;
  nurseApproved: boolean;
  setNurseApproved: (value: boolean) => void;
  approvingNurse: string;
  setApprovingNurse: (value: string) => void;
  canEnterLabs: boolean;
}

/*
 * Nurse approval before a result is saved. Sizes follow DESIGN.md: 14 px text and larger, and each
 * checkbox row is a 44 px target. The status is a chip with an icon and a word.
 */
const CHECK_ROW =
  "flex min-h-11 cursor-pointer items-center gap-3 type-body-sm";
const CHECKBOX = "clay-focus size-5 shrink-0 rounded-xs accent-(--sage-deep)";

export function NurseApprovalCard({
  requireApproval,
  setRequireApproval,
  nurseApproved,
  setNurseApproved,
  approvingNurse,
  setApprovingNurse,
  canEnterLabs,
}: NurseApprovalCardProps) {
  return (
    <fieldset className="min-w-0 rounded-sm border border-hairline bg-ground p-3 sm:p-4">
      <legend className="px-1 type-field-label">Nurse approval</legend>
      <label className={CHECK_ROW}>
        <input
          type="checkbox"
          checked={requireApproval}
          onChange={event => {
            setRequireApproval(event.target.checked);
            if (!event.target.checked) setNurseApproved(false);
          }}
          className={CHECKBOX}
        />
        <span>Require nurse approval before the save</span>
      </label>

      {requireApproval && (
        <>
          <label className={CHECK_ROW}>
            <input
              type="checkbox"
              name="nurseApproved"
              checked={nurseApproved}
              onChange={event => setNurseApproved(event.target.checked)}
              className={CHECKBOX}
            />
            <span className="font-bold">
              The attending nurse checked and approved these results
            </span>
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-8">
            <StatusChip
              status={nurseApproved ? "done" : "due-soon"}
              label={nurseApproved ? "Approved" : "Approval required"}
              srContext="Nurse approval:"
            />
            <p className="type-caption text-ink-muted">
              {canEnterLabs
                ? "Check each value against the laboratory sheet."
                : "Check this record before the save."}
            </p>
          </div>
          {nurseApproved && (
            <ClayInput
              name="approvedByNurse"
              label="Approving nurse name or license (optional)"
              maxLength={200}
              value={approvingNurse}
              onChange={event => setApprovingNurse(event.target.value)}
              containerClassName="mt-3"
            />
          )}
        </>
      )}
    </fieldset>
  );
}
