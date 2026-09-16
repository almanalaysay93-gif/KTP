import { beforeEach, describe, expect, it, vi } from "vitest";
import { staffAccountRouter } from "./routers/staffAccount";
import * as db from "./db";

vi.mock("./db", () => ({
  getNurseById: vi.fn(),
  listAreas: vi.fn(),
  listCredentialTypes: vi.fn(),
  listTrainingCatalog: vi.fn(),
  getNurseLicenseInfo: vi.fn(),
  listCredentials: vi.fn(),
  listNurseTrainings: vi.fn(),
  listAssignmentsForNurse: vi.fn(),
}));

const caller = (claimNurseId: number | null = 9) => staffAccountRouter.createCaller({
  user: null, claimNurseId, req: {} as any, res: {} as any,
});

beforeEach(() => vi.resetAllMocks());

describe("staff profile loading", () => {
  it("starts independent reads without waiting for the area lookup", async () => {
    vi.mocked(db.getNurseById).mockResolvedValue({ id: 9, currentAreaId: 2 } as any);
    let release!: (rows: any[]) => void;
    vi.mocked(db.listAreas).mockImplementation(() => new Promise(resolve => { release = resolve; }));
    vi.mocked(db.listCredentialTypes).mockResolvedValue([{ id: 3, name: "PRC" }] as any);
    vi.mocked(db.listTrainingCatalog).mockResolvedValue([{ id: 4, name: "BLS" }] as any);
    vi.mocked(db.getNurseLicenseInfo).mockResolvedValue({ status: "Valid", licenseNumber: "TEST" } as any);
    vi.mocked(db.listCredentials).mockResolvedValue([{ nurseId: 9, credentialTypeId: 3 }] as any);
    vi.mocked(db.listNurseTrainings).mockResolvedValue([{ nurseId: 9, trainingId: 4 }] as any);
    vi.mocked(db.listAssignmentsForNurse).mockResolvedValue([{ nurseId: 9, areaId: 2 }] as any);
    const pending = caller().myProfile();
    await vi.waitFor(() => expect(db.listAreas).toHaveBeenCalled());
    try {
      expect(db.getNurseLicenseInfo).toHaveBeenCalledWith(9);
      expect(db.listCredentials).toHaveBeenCalledWith({ nurseId: 9 });
      expect(db.listNurseTrainings).toHaveBeenCalledWith({ nurseId: 9 });
      expect(db.listAssignmentsForNurse).toHaveBeenCalledWith(9);
    } finally {
      release([{ id: 2, name: "Ward" }]);
      await pending;
    }
    expect(await pending).toMatchObject({
      id: 9, authMode: "claim", currentArea: { name: "Ward" },
      licenseStatus: "Valid", licenseNumber: "TEST",
      credentials: [{ typeName: "PRC" }], trainings: [{ trainingName: "BLS" }],
      assignments: [{ areaName: "Ward", area: { id: 2 } }],
    });
  });

  it("rejects unauthenticated reads before accessing profile data", async () => {
    await expect(caller(null).myProfile()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(db.getNurseById).not.toHaveBeenCalled();
  });

  it("stops when the staff record does not exist", async () => {
    vi.mocked(db.getNurseById).mockResolvedValue(undefined);
    await expect(caller().myProfile()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.listCredentials).not.toHaveBeenCalled();
  });
});
