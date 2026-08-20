import { beforeEach, describe, expect, it, vi } from "vitest";

const insertOne = vi.fn();
const sort = vi.fn();
const find = vi.fn(() => ({ sort }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    collection: () => ({
      insertOne,
      find,
    }),
  }),
}));

const TRIP_ID = "507f1f77bcf86cd799439099";
const VEHICLE_ID = "507f1f77bcf86cd799439011";

const SNAPSHOT_INPUT = {
  tripId: TRIP_ID,
  vehicleId: VEHICLE_ID,
  batteryLevel: 77,
  shiftState: "D",
  charging: false,
  pluggedIn: false,
  chargingState: "Disconnected",
  energyAdded: 0,
  odometer: 15230,
  chargerPower: 0,
  latitude: 44.5,
  longitude: 11.3,
};

describe("createPollSnapshot", () => {
  beforeEach(() => {
    insertOne.mockReset();
  });

  it("inserts a poll snapshot scoped to the trip and vehicle", async () => {
    insertOne.mockResolvedValue({ acknowledged: true });
    const { createPollSnapshot } = await import("./poll-snapshot");

    const snapshot = await createPollSnapshot(SNAPSHOT_INPUT);

    expect(snapshot.tripId).toBe(TRIP_ID);
    expect(snapshot.vehicleId).toBe(VEHICLE_ID);
    expect(snapshot.batteryLevel).toBe(77);
    expect(snapshot.chargingState).toBe("Disconnected");
    expect(typeof snapshot.polledAt).toBe("string");
    expect(insertOne).toHaveBeenCalledOnce();
  });
});

describe("listPollSnapshotsByTrip", () => {
  it("returns snapshots for the trip sorted oldest-first", async () => {
    sort.mockReturnValue({
      toArray: () =>
        Promise.resolve([
          {
            _id: { toHexString: () => "snap1" },
            tripId: { toHexString: () => TRIP_ID },
            vehicleId: { toHexString: () => VEHICLE_ID },
            polledAt: new Date("2026-08-20T07:00:00.000Z"),
            batteryLevel: 77,
            shiftState: "D",
            charging: false,
            pluggedIn: false,
            chargingState: "Disconnected",
            energyAdded: 0,
            odometer: 15230,
            chargerPower: 0,
            latitude: 44.5,
            longitude: 11.3,
          },
        ]),
    });
    const { listPollSnapshotsByTrip } = await import("./poll-snapshot");

    const snapshots = await listPollSnapshotsByTrip(TRIP_ID);

    expect(snapshots).toHaveLength(1);
    expect(sort).toHaveBeenCalledWith({ polledAt: 1, _id: 1 });
  });
});
