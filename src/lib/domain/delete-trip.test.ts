import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteTrip = vi.fn();
const deleteDriveSegmentsByTrip = vi.fn();
const deleteChargeSessionsByTrip = vi.fn();
const deleteRouteLog = vi.fn();
const deletePollSnapshotsByTrip = vi.fn();

vi.mock("@/lib/models/trip", () => ({
  deleteTrip: (...args: unknown[]) => deleteTrip(...args),
}));
vi.mock("@/lib/models/drive-segment", () => ({
  deleteDriveSegmentsByTrip: (...args: unknown[]) => deleteDriveSegmentsByTrip(...args),
}));
vi.mock("@/lib/models/charge-session", () => ({
  deleteChargeSessionsByTrip: (...args: unknown[]) => deleteChargeSessionsByTrip(...args),
}));
vi.mock("@/lib/models/route-log", () => ({
  deleteRouteLog: (...args: unknown[]) => deleteRouteLog(...args),
}));
vi.mock("@/lib/models/poll-snapshot", () => ({
  deletePollSnapshotsByTrip: (...args: unknown[]) => deletePollSnapshotsByTrip(...args),
}));

const TRIP_ID = "507f1f77bcf86cd799439099";

describe("deleteTripCascade", () => {
  beforeEach(() => {
    deleteTrip.mockReset();
    deleteDriveSegmentsByTrip.mockReset().mockResolvedValue(undefined);
    deleteChargeSessionsByTrip.mockReset().mockResolvedValue(undefined);
    deleteRouteLog.mockReset().mockResolvedValue(undefined);
    deletePollSnapshotsByTrip.mockReset().mockResolvedValue(undefined);
  });

  it("deletes derived data and the trip, returning true when the trip existed", async () => {
    deleteTrip.mockResolvedValue(true);
    const { deleteTripCascade } = await import("./delete-trip");

    const result = await deleteTripCascade(TRIP_ID);

    expect(result).toBe(true);
    expect(deleteDriveSegmentsByTrip).toHaveBeenCalledWith(TRIP_ID);
    expect(deleteChargeSessionsByTrip).toHaveBeenCalledWith(TRIP_ID);
    expect(deleteRouteLog).toHaveBeenCalledWith(TRIP_ID);
    expect(deletePollSnapshotsByTrip).toHaveBeenCalledWith(TRIP_ID);
    expect(deleteTrip).toHaveBeenCalledWith(TRIP_ID);
  });

  it("returns false when the trip did not exist", async () => {
    deleteTrip.mockResolvedValue(false);
    const { deleteTripCascade } = await import("./delete-trip");

    await expect(deleteTripCascade(TRIP_ID)).resolves.toBe(false);
  });
});
