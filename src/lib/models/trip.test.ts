import { beforeEach, describe, expect, it, vi } from "vitest";

const insertOne = vi.fn();
const createIndex = vi.fn().mockResolvedValue("vehicleId_1");
const findOne = vi.fn();
const sort = vi.fn();
const find = vi.fn(() => ({ sort }));
const findOneAndUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    collection: () => ({
      insertOne,
      createIndex,
      findOne,
      find,
      findOneAndUpdate,
    }),
  }),
}));

const VEHICLE_ID = "507f1f77bcf86cd799439011";
const TRIP_ID = "507f1f77bcf86cd799439099";

describe("startTrip", () => {
  beforeEach(() => {
    insertOne.mockReset();
  });

  it("creates an active trip for the vehicle", async () => {
    insertOne.mockResolvedValue({ acknowledged: true });
    const { startTrip } = await import("./trip");

    const trip = await startTrip(VEHICLE_ID);

    expect(trip.vehicleId).toBe(VEHICLE_ID);
    expect(trip.endedAt).toBeNull();
    expect(typeof trip.startedAt).toBe("string");
  });

  it("blocks starting a second trip when one is already active (duplicate key from the partial unique index)", async () => {
    insertOne.mockRejectedValue(Object.assign(new Error("E11000 duplicate key"), { code: 11000 }));
    const { startTrip, TripAlreadyActiveError } = await import("./trip");

    await expect(startTrip(VEHICLE_ID)).rejects.toThrow(TripAlreadyActiveError);
  });

  it("rethrows unrelated errors", async () => {
    insertOne.mockRejectedValue(new Error("connection reset"));
    const { startTrip } = await import("./trip");

    await expect(startTrip(VEHICLE_ID)).rejects.toThrow("connection reset");
  });
});

describe("getActiveTrip", () => {
  beforeEach(() => {
    findOne.mockReset();
  });

  it("returns the active trip when one exists", async () => {
    findOne.mockResolvedValue({
      _id: { toHexString: () => TRIP_ID },
      vehicleId: { toHexString: () => VEHICLE_ID },
      startedAt: new Date("2026-08-20T07:00:00.000Z"),
      endedAt: null,
    });
    const { getActiveTrip } = await import("./trip");

    const trip = await getActiveTrip(VEHICLE_ID);

    expect(trip).not.toBeNull();
    expect(trip?.id).toBe(TRIP_ID);
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({ endedAt: null }),
    );
  });

  it("returns null when no trip is active", async () => {
    findOne.mockResolvedValue(null);
    const { getActiveTrip } = await import("./trip");

    const trip = await getActiveTrip(VEHICLE_ID);

    expect(trip).toBeNull();
  });
});

describe("stopTrip", () => {
  it("marks the trip closed and returns it", async () => {
    findOneAndUpdate.mockResolvedValue({
      _id: { toHexString: () => TRIP_ID },
      vehicleId: { toHexString: () => VEHICLE_ID },
      startedAt: new Date("2026-08-20T07:00:00.000Z"),
      endedAt: new Date("2026-08-20T09:00:00.000Z"),
    });
    const { stopTrip } = await import("./trip");

    const trip = await stopTrip(TRIP_ID);

    expect(trip?.endedAt).not.toBeNull();
  });

  it("returns null when the trip is not active (already stopped or missing)", async () => {
    findOneAndUpdate.mockResolvedValue(null);
    const { stopTrip } = await import("./trip");

    const trip = await stopTrip(TRIP_ID);

    expect(trip).toBeNull();
  });
});

describe("listTrips", () => {
  it("returns trips sorted newest-first", async () => {
    sort.mockReturnValue({
      toArray: () =>
        Promise.resolve([
          {
            _id: { toHexString: () => "trip1" },
            vehicleId: { toHexString: () => VEHICLE_ID },
            startedAt: new Date("2026-08-20T07:00:00.000Z"),
            endedAt: null,
          },
        ]),
    });
    const { listTrips } = await import("./trip");

    const trips = await listTrips(VEHICLE_ID);

    expect(trips).toHaveLength(1);
    expect(sort).toHaveBeenCalledWith({ startedAt: -1 });
  });
});
