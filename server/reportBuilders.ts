/**
 * Pure report shaping shared by the Postgres and SQLite report paths, so both
 * return the same rows for the same data.
 */
import { dateKey, nurseFullName } from "../shared/nursetrack";

type NameParts = { firstName: string; middleName?: string | null; lastName: string; suffix?: string | null };

/** Whole days from start to end (or today when end is open). Never negative. */
export function daysBetween(start: string, end: string | null, today: string): number {
  const s = new Date(`${start}T00:00:00`).getTime();
  const e = new Date(`${end ?? today}T00:00:00`).getTime();
  return e >= s ? Math.floor((e - s) / 86400000) : 0;
}

export type ComplianceInput = {
  areas: { id: number; name: string }[];
  requirements: { areaId: number; trainingId: number }[];
  nurses: { id: number; currentAreaId: number | null }[];
  completedRecords: { nurseId: number; trainingId: number; expiryDate: string | Date | null }[];
  today: string;
};

export type ComplianceRow = {
  areaName: string;
  requiredTrainings: number;
  staffCount: number;
  requiredChecks: number;
  compliantChecks: number;
  compliancePercent: number;
};

/** One row per area: share of (staff x required training) pairs with a current Completed record. */
export function buildTrainingCompliance(input: ComplianceInput): ComplianceRow[] {
  const requiredByArea = new Map<number, Set<number>>();
  for (const r of input.requirements) {
    if (!requiredByArea.has(r.areaId)) requiredByArea.set(r.areaId, new Set());
    requiredByArea.get(r.areaId)!.add(r.trainingId);
  }
  const staffByArea = new Map<number, number[]>();
  for (const n of input.nurses) {
    if (n.currentAreaId == null) continue;
    if (!staffByArea.has(n.currentAreaId)) staffByArea.set(n.currentAreaId, []);
    staffByArea.get(n.currentAreaId)!.push(n.id);
  }
  // A record counts when it has no expiry or expires after today.
  const current = new Set<string>();
  for (const r of input.completedRecords) {
    const exp = r.expiryDate ? dateKey(r.expiryDate) : "";
    if (!exp || exp > input.today) current.add(`${r.nurseId}:${r.trainingId}`);
  }
  return input.areas.map((area) => {
    const required = Array.from(requiredByArea.get(area.id) ?? []);
    const staff = staffByArea.get(area.id) ?? [];
    let compliant = 0;
    for (const nurseId of staff) {
      for (const trainingId of required) {
        if (current.has(`${nurseId}:${trainingId}`)) compliant++;
      }
    }
    const total = staff.length * required.length;
    return {
      areaName: area.name,
      requiredTrainings: required.length,
      staffCount: staff.length,
      requiredChecks: total,
      compliantChecks: compliant,
      compliancePercent: total > 0 ? Math.round((compliant / total) * 100) : 100,
    };
  });
}

export type ExposureAssignment = NameParts & {
  nurseId: number;
  areaId: number;
  areaName: string;
  startDate: string | Date;
  endDate: string | Date | null;
  licenseNumber: string | null;
  employeeId: string;
};

export type ExposureRow = {
  nurseId: number;
  nurse: string;
  licenseNumber: string;
  areaName: string;
  firstStart: string;
  lastEnd: string;
  assignments: number;
  totalDays: number;
};

/** One row per nurse per area, with the days of every assignment in that area added up. */
export function buildAreaExposure(rows: ExposureAssignment[], today: string): ExposureRow[] {
  const groups = new Map<string, { row: ExposureRow; open: boolean; maxEnd: string }>();
  for (const r of rows) {
    const start = dateKey(r.startDate);
    if (!start) continue;
    const end = r.endDate ? dateKey(r.endDate) || null : null;
    const key = `${r.nurseId}:${r.areaId}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        row: {
          nurseId: r.nurseId,
          nurse: nurseFullName(r),
          licenseNumber: r.licenseNumber || r.employeeId,
          areaName: r.areaName,
          firstStart: start,
          lastEnd: "",
          assignments: 0,
          totalDays: 0,
        },
        open: false,
        maxEnd: "",
      };
      groups.set(key, g);
    }
    g.row.assignments += 1;
    g.row.totalDays += daysBetween(start, end, today);
    if (start < g.row.firstStart) g.row.firstStart = start;
    if (end === null) g.open = true;
    else if (end > g.maxEnd) g.maxEnd = end;
  }
  return Array.from(groups.values())
    .map((g) => ({ ...g.row, lastEnd: g.open ? "Present" : g.maxEnd }))
    .sort((a, b) => a.nurse.localeCompare(b.nurse) || a.areaName.localeCompare(b.areaName));
}
