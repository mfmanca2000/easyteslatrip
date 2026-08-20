import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMany = vi.fn();
const deleteMany = vi.fn();
const sort = vi.fn();
const find = vi.fn(() => ({ sort }));
const findOneAndUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    collection: () => ({
      insertMany,
      deleteMany,
      find,
      findOneAndUpdate,
    }),
  }),
}));

const TRIP_ID = "507f1f77bcf86cd799439099";
const VEHICLE_ID = "507f1f77bcf86cd799439011";

describe("saveChargeSessions", () => {
  beforeEach(() => {
    insertMany.mockReset();
    deleteMany.mockReset();
    deleteMany.mockResolvedValue({ acknowledged: true });
  });

  it("replaces the trip's sessions with the given set", async () => {
    insertMany.mockResolvedValue({ acknowledged: true });
    const { saveChargeSessions } = await import("./charge-session");

    await saveChargeSessions(TRIP_ID, VEHICLE_ID, [
      {
        startedAt: new Date("2026-08-20T07:00:00.000Z"),
        endedAt: new Date("2026-08-20T08:00:00.000Z"),
        startBatteryLevel: 40,
        endBatteryLevel: 90,
        energyAdded: 35,
        latitude: 44.5,
        longitude: 11.3,
        placeName: "Bologna, Italy",
        costPerKwh: null,
        costTotal: null,
        free: false,
      },
    ]);

    expect(deleteMany).toHaveBeenCalledWith({ tripId: expect.anything() });
    expect(insertMany).toHaveBeenCalledOnce();
    const savedDocs = insertMany.mock.calls[0][0];
    expect(savedDocs).toHaveLength(1);
    expect(savedDocs[0].placeName).toBe("Bologna, Italy");
  });

  it("clears the trip's sessions and skips insert when given an empty set", async () => {
    const { saveChargeSessions } = await import("./charge-session");

    await saveChargeSessions(TRIP_ID, VEHICLE_ID, []);

    expect(deleteMany).toHaveBeenCalledOnce();
    expect(insertMany).not.toHaveBeenCalled();
  });
});

describe("listChargeSessionsByTrip", () => {
  it("returns sessions sorted oldest-first", async () => {
    sort.mockReturnValue({
      toArray: () =>
        Promise.resolve([
          {
            _id: { toHexString: () => "sess1" },
            tripId: { toHexString: () => TRIP_ID },
            vehicleId: { toHexString: () => VEHICLE_ID },
            startedAt: new Date("2026-08-20T07:00:00.000Z"),
            endedAt: null,
            startBatteryLevel: 40,
            endBatteryLevel: null,
            energyAdded: null,
            latitude: 44.5,
            longitude: 11.3,
            placeName: null,
          },
        ]),
    });
    const { listChargeSessionsByTrip } = await import("./charge-session");

    const sessions = await listChargeSessionsByTrip(TRIP_ID);

    expect(sessions).toHaveLength(1);
    expect(sort).toHaveBeenCalledWith({ startedAt: 1 });
  });
});

describe("updateChargeSession", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
  });

  const SESSION_ID = "507f1f77bcf86cd799439033";

  it("applies the patch and returns the updated session", async () => {
    findOneAndUpdate.mockResolvedValue({
      _id: { toHexString: () => SESSION_ID },
      tripId: { toHexString: () => TRIP_ID },
      vehicleId: { toHexString: () => VEHICLE_ID },
      startedAt: new Date("2026-08-20T07:00:00.000Z"),
      endedAt: new Date("2026-08-20T08:00:00.000Z"),
      startBatteryLevel: 40,
      endBatteryLevel: 90,
      energyAdded: 35,
      latitude: 44.5,
      longitude: 11.3,
      placeName: "Bologna, Italy",
      costPerKwh: null,
      costTotal: 12.5,
      free: false,
    });
    const { updateChargeSession } = await import("./charge-session");

    const session = await updateChargeSession(SESSION_ID, { costTotal: 12.5, free: false });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $set: { costTotal: 12.5, free: false } },
      { returnDocument: "after" },
    );
    expect(session?.costTotal).toBe(12.5);
  });

  it("returns null when the session does not exist", async () => {
    findOneAndUpdate.mockResolvedValue(null);
    const { updateChargeSession } = await import("./charge-session");

    const session = await updateChargeSession(SESSION_ID, { free: true });

    expect(session).toBeNull();
  });
});
