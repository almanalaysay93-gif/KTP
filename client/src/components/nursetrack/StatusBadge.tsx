import { cn } from "@/lib/utils";
import {
  LICENSE_STATUS_META,
  type LicenseStatus,
  formatDate,
  daysUntilExpiry,
} from "../../../../shared/nursetrack";
import { AlertCircle, AlertTriangle, BadgeCheck, Clock, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface LicenseStatusBadgeProps {
  status: LicenseStatus;
  expiryDate?: string | Date | null;
  licenseNumber?: string | null;
  daysRemaining?: number | null;
  showPrefix?: boolean;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

/** Color-coded status badge with icon + label + hover details explaining PRC status, timeline, and actions. */
export function LicenseStatusBadge({
  status,
  expiryDate,
  licenseNumber,
  daysRemaining,
  showPrefix = false,
  className,
  side = "top",
}: LicenseStatusBadgeProps) {
  const meta = LICENSE_STATUS_META[status] ?? { label: status, color: "green" };
  const icon =
    status === "Expired" ? (
      <AlertCircle className="h-3 w-3 shrink-0" />
    ) : status === "Within 6 Months" ? (
      <AlertTriangle className="h-3 w-3 shrink-0" />
    ) : status === "Within 1 Year" ? (
      <Clock className="h-3 w-3 shrink-0" />
    ) : (
      <BadgeCheck className="h-3 w-3 shrink-0" />
    );

  const formattedDate = expiryDate ? formatDate(expiryDate) : null;
  const days =
    daysRemaining !== undefined && daysRemaining !== null
      ? daysRemaining
      : expiryDate
        ? daysUntilExpiry(expiryDate)
        : null;

  let title = "PRC Professional License";
  let badgeLabel = meta.label;
  let summary = "";
  let actionHint = "";

  if (status === "Expired") {
    title = "PRC License: Expired";
    summary =
      days !== null && days < 0
        ? `Validity ended on ${formattedDate} (${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} overdue).`
        : formattedDate
          ? `Validity ended on ${formattedDate}.`
          : "License validity period has expired.";
    actionHint = "Immediate PRC renewal filing required to authorize clinical duties.";
  } else if (status === "Within 6 Months") {
    title = "PRC License: Renewal Due Soon";
    summary =
      days !== null
        ? `Valid until ${formattedDate} (${days} ${days === 1 ? "day" : "days"} remaining). Critical renewal timeline.`
        : formattedDate
          ? `Valid until ${formattedDate}. Critical renewal window open.`
          : "License expires within 6 months.";
    actionHint = "Submit CPD credit units and complete renewal on PRC LERIS portal.";
  } else if (status === "Within 1 Year") {
    title = "PRC License: Upcoming Renewal";
    summary =
      days !== null
        ? `Valid until ${formattedDate} (${days} ${days === 1 ? "day" : "days"} remaining). Annual notice window.`
        : formattedDate
          ? `Valid until ${formattedDate}.`
          : "License expires within 12 months.";
    actionHint = "Ensure required CPD units are completed ahead of expiry.";
  } else {
    title = "PRC License: Valid & Compliant";
    summary =
      days !== null && days > 0
        ? `Valid until ${formattedDate} (${days} ${days === 1 ? "day" : "days"} remaining).`
        : formattedDate
          ? `Valid until ${formattedDate}.`
          : "License is active and compliant with regulatory standards.";
    actionHint = "No immediate renewal action required.";
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap cursor-help transition-all hover:ring-2 select-none",
            meta.color === "red" && "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900",
            meta.color === "orange" && "bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:ring-orange-900",
            meta.color === "yellow" && "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:ring-yellow-900",
            meta.color === "green" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900",
            className,
          )}
        >
          {icon}
          <span>{showPrefix ? `PRC: ${meta.label}` : meta.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs p-3 space-y-2 bg-popover text-popover-foreground border shadow-lg">
        <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1.5">
          <span className="font-bold text-xs flex items-center gap-1 text-foreground">
            {icon}
            {title}
          </span>
          <span
            className={cn(
              "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
              meta.color === "red" && "bg-red-500/10 text-red-600 dark:text-red-400",
              meta.color === "orange" && "bg-orange-500/10 text-orange-600 dark:text-orange-400",
              meta.color === "yellow" && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
              meta.color === "green" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {badgeLabel}
          </span>
        </div>

        {licenseNumber && (
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>PRC License Number:</span>
            <span className="font-mono font-bold text-foreground">{licenseNumber}</span>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {summary}
        </p>

        <div className="text-[10px] text-muted-foreground pt-1.5 border-t border-border/50 flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
          <span>{actionHint}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export interface EmploymentStatusBadgeProps {
  status: string;
  className?: string;
  showPrefix?: boolean;
  side?: "top" | "bottom" | "left" | "right";
}

export function EmploymentStatusBadge({
  status,
  className,
  showPrefix = false,
  side = "top",
}: EmploymentStatusBadgeProps) {
  const tone =
    status === "Active"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900"
      : status === "On Leave" || status === "Temporary Assignment"
        ? "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:ring-yellow-900"
        : status === "Transferred"
          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900"
          : "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800";

  let description = "Staff member is currently active on hospital roster and eligible for ward shift assignments.";
  let dutyStatus = "Eligible for clinical shifts";
  if (status === "On Leave") {
    description = "Approved temporary leave of absence (maternity, study, medical, or vacation). Excused from duty roster.";
    dutyStatus = "Excused from shifts";
  } else if (status === "Temporary Assignment") {
    description = "Temporarily detailed or on special assignment outside primary unit.";
    dutyStatus = "Special assignment";
  } else if (status === "Transferred") {
    description = "Reassigned to another health facility or department.";
    dutyStatus = "Transferred out";
  } else if (status === "Resigned") {
    description = "Officially separated from hospital service.";
    dutyStatus = "Separated";
  } else if (status === "Retired") {
    description = "Retired from government service.";
    dutyStatus = "Retired";
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap cursor-help transition-all hover:ring-2 select-none",
            tone,
            className
          )}
        >
          {showPrefix ? `Employment: ${status}` : status}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs p-3 space-y-2 bg-popover text-popover-foreground border shadow-lg">
        <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1.5">
          <span className="font-bold text-xs text-foreground">
            Employment Status
          </span>
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-muted text-foreground">
            {status}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div className="text-[10px] text-muted-foreground pt-1.5 border-t border-border/50 flex items-center justify-between">
          <span>Duty Roster Status:</span>
          <span className="font-semibold text-foreground">{dutyStatus}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function TrainingStatusBadge({
  status,
  className,
  side = "top",
}: {
  status: string;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const tone =
    status === "Completed"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900"
      : status === "Scheduled"
        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900"
        : status === "Expired"
          ? "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900"
          : "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800";

  let detail = "Training requirements met and certificate verified.";
  if (status === "Scheduled") detail = "Enrolled in scheduled training session. Attendance pending.";
  else if (status === "Expired") detail = "Periodic training renewal or re-certification overdue.";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap cursor-help transition-all hover:ring-2 select-none",
            tone,
            className
          )}
        >
          {status}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs p-2.5 text-xs bg-popover text-popover-foreground border shadow-md space-y-1">
        <div className="font-bold text-xs text-foreground">Training: {status}</div>
        <div className="text-[11px] text-muted-foreground">{detail}</div>
      </TooltipContent>
    </Tooltip>
  );
}
