import { cn } from "@/lib/utils";
import { ClayInput } from "@/components/clay";

export interface NurseApprovalCardProps {
  requireApproval: boolean;
  setRequireApproval: (value: boolean) => void;
  nurseApproved: boolean;
  setNurseApproved: (value: boolean) => void;
  approvingNurse: string;
  setApprovingNurse: (value: string) => void;
  canEnterLabs: boolean;
}

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
    <div className="rounded-sm border border-line-strong/30 bg-ground-elevated p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="type-body-sm font-bold text-ink">Nurse approval option</p>
          <p className="text-xs text-ink-muted">
            Require attending nurse verification before results can be saved.
          </p>
        </div>
        <label className="clay-focus inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
          <input
            type="checkbox"
            checked={requireApproval}
            onChange={e => {
              setRequireApproval(e.target.checked);
              if (!e.target.checked) setNurseApproved(false);
            }}
            className="size-4 rounded border-line-strong text-olive focus:ring-olive"
          />
          <span>Require nurse approval</span>
        </label>
      </div>

      {requireApproval && (
        <div
          className={cn(
            "rounded-sm border p-3 transition-colors",
            nurseApproved
              ? "border-olive/50 bg-olive-tint/20"
              : "border-line-strong/30 bg-ground"
          )}
        >
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              name="nurseApproved"
              checked={nurseApproved}
              onChange={e => setNurseApproved(e.target.checked)}
              className="mt-0.5 size-4 rounded border-line-strong text-olive focus:ring-olive"
            />
            <div className="space-y-1">
              <span className="font-bold text-ink text-xs flex items-center gap-2">
                <span>Attending nurse has reviewed and approved results</span>
                {nurseApproved ? (
                  <span className="rounded bg-olive/15 px-1.5 py-0.5 text-[10px] font-semibold text-olive">
                    Approved
                  </span>
                ) : (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    Approval required
                  </span>
                )}
              </span>
              <p className="text-xs text-ink-muted">
                {canEnterLabs
                  ? "Nurse must verify all auto-filled or typed lab values against the original laboratory sheet before saving."
                  : "Nurse must verify and approve this clinical record before saving."}
              </p>
            </div>
          </label>
          {nurseApproved && (
            <div className="mt-2.5 pt-2.5 border-t border-line">
              <ClayInput
                name="approvedByNurse"
                label="Approving Nurse Name or License (optional)"
                placeholder="e.g., RN Dela Cruz"
                value={approvingNurse}
                onChange={e => setApprovingNurse(e.target.value)}
              />
            </div>
          )}
        </div>
      )}
      {requireApproval && !nurseApproved && (
        <p className="text-xs font-medium text-amber-700">
          Save disabled until attending nurse review and approval is checked.
        </p>
      )}
    </div>
  );
}
