import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { listResolvedTrainingSchedules, resolveTrainingSchedule } from "./trainingReminders";

const mocks = vi.hoisted(() => ({ select: vi.fn(), where: vi.fn(), rows: [] as any[] }));
vi.mock("./db", () => ({ getDb: async () => ({ select: mocks.select }) }));

beforeEach(() => {
  vi.clearAllMocks();
  const chain = {
    from: () => chain,
    leftJoin: () => chain,
    where: mocks.where.mockImplementation(() => chain),
    orderBy: async () => mocks.rows,
  };
  mocks.select.mockReturnValue(chain);
  mocks.rows = Array.from({ length: 100 }, (_, id) => ({
    assignment: { id, nurseId: 9, trainingId: 3, status: "Scheduled", scheduledDate: new Date("2026-09-20T00:00:00Z") },
    event: null,
    catalog: { name: "BLS" },
  }));
});

describe("calendar schedule loading", () => {
  it("loads 100 assignments in one query scoped to the signed-in nurse", async () => {
    const schedules = await listResolvedTrainingSchedules(9);
    expect(schedules).toHaveLength(100);
    expect(mocks.select).toHaveBeenCalledTimes(1);
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(query.sql).toContain('"nurseTrainings"."nurseId"');
    expect(query.params).toEqual([9]);
    expect(schedules[0]).toMatchObject({ nurseId: 9, trainingName: "BLS", startDateStr: "2026-09-20", endDateStr: "2026-09-20" });
  });

  it("retains event dates, times, and instructions", async () => {
    mocks.rows[0].event = { startDate: new Date("2026-10-01T00:00:00Z"), endDate: new Date("2026-10-02T00:00:00Z"), startTime: "08:00", venue: "Room 1", remarks: "Bring certificate" };
    expect((await listResolvedTrainingSchedules(9))[0]).toMatchObject({ startDateStr: "2026-10-01", endDateStr: "2026-10-02", startTime: "08:00", venue: "Room 1", remarks: "Bring certificate" });
  });

  it("preserves missing assignment and empty calendar behavior", async () => {
    mocks.rows = [];
    expect(await listResolvedTrainingSchedules(9)).toEqual([]);
    expect(await resolveTrainingSchedule(123)).toBeNull();
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[1][0]);
    expect(query.sql).toContain('"nurseTrainings"."id"');
    expect(query.params).toEqual([123]);
  });
});
