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

describe("saveDriveSegments", () => {
  beforeEach(() => {
    insertMany.mockReset();
    deleteMany.mockReset();
    deleteMany.mockResolvedValue({ acknowledged: true });
  });

  it("replaces the trip's segments with the given set", async () => {
    insertMany.mockResolvedValue({ acknowledged: true });
    const { saveDriveSegments } = await import("./drive-segment");

    await saveDriveSegments(TRIP_ID, VEHICLE_ID, [
      {
        startedAt: new Date("2026-08-20T07:00:00.000Z"),
        endedAt: new Date("2026-08-20T07:10:00.000Z"),
        startOdometer: 15000,
        endOdometer: 15010,
        distanceKm: 10,
        startLatitude: 44.5,
        startLongitude: 11.3,
        endLatitude: 44.6,
        endLongitude: 11.4,
        startPlaceName: "Bologna, Italy",
        endPlaceName: "Modena, Italy",
      },
    ]);

    expect(deleteMany).toHaveBeenCalledWith({ tripId: expect.anything() });
    expect(insertMany).toHaveBeenCalledOnce();
    const savedDocs = insertMany.mock.calls[0][0];
    expect(savedDocs).toHaveLength(1);
    expect(savedDocs[0].startPlaceName).toBe("Bologna, Italy");
  });

  it("clears the trip's segments and skips insert when given an empty set", async () => {
    const { saveDriveSegments } = await import("./drive-segment");

    await saveDriveSegments(TRIP_ID, VEHICLE_ID, []);

    expect(deleteMany).toHaveBeenCalledOnce();
    expect(insertMany).not.toHaveBeenCalled();
  });
});

describe("listDriveSegmentsByTrip", () => {
  it("returns segments sorted oldest-first", async () => {
    sort.mockReturnValue({
      toArray: () =>
        Promise.resolve([
          {
            _id: { toHexString: () => "seg1" },
            tripId: { toHexString: () => TRIP_ID },
            vehicleId: { toHexString: () => VEHICLE_ID },
            startedAt: new Date("2026-08-20T07:00:00.000Z"),
            endedAt: null,
            startOdometer: 15000,
            endOdometer: null,
            distanceKm: null,
            startLatitude: 44.5,
            startLongitude: 11.3,
            endLatitude: null,
            endLongitude: null,
            startPlaceName: null,
            endPlaceName: null,
          },
        ]),
    });
    const { listDriveSegmentsByTrip } = await import("./drive-segment");

    const segments = await listDriveSegmentsByTrip(TRIP_ID);

    expect(segments).toHaveLength(1);
    expect(sort).toHaveBeenCalledWith({ startedAt: 1 });
  });
});

describe("listDriveSegmentsByTripIds", () => {
  it("returns an empty array without querying when given no trip ids", async () => {
    const findCallsBefore = find.mock.calls.length;
    const { listDriveSegmentsByTripIds } = await import("./drive-segment");

    const segments = await listDriveSegmentsByTripIds([]);

    expect(segments).toEqual([]);
    expect(find.mock.calls.length).toBe(findCallsBefore);
  });

  it("queries with $in across the given trip ids", async () => {
    sort.mockReturnValue({ toArray: () => Promise.resolve([]) });
    const { listDriveSegmentsByTripIds } = await import("./drive-segment");

    await listDriveSegmentsByTripIds([TRIP_ID]);

    expect(find).toHaveBeenCalledWith({ tripId: { $in: [expect.anything()] } });
    expect(sort).toHaveBeenCalledWith({ startedAt: 1 });
  });
});

describe("updateDriveSegment", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
  });

  const SEGMENT_ID = "507f1f77bcf86cd799439022";

  it("applies the patch and returns the updated segment", async () => {
    findOneAndUpdate.mockResolvedValue({
      _id: { toHexString: () => SEGMENT_ID },
      tripId: { toHexString: () => TRIP_ID },
      vehicleId: { toHexString: () => VEHICLE_ID },
      startedAt: new Date("2026-08-20T07:00:00.000Z"),
      endedAt: new Date("2026-08-20T07:10:00.000Z"),
      startOdometer: 15000,
      endOdometer: 15010,
      distanceKm: 10,
      startLatitude: 44.5,
      startLongitude: 11.3,
      endLatitude: 44.6,
      endLongitude: 11.4,
      startPlaceName: "Custom name",
      endPlaceName: "Modena, Italy",
    });
    const { updateDriveSegment } = await import("./drive-segment");

    const segment = await updateDriveSegment(SEGMENT_ID, { startPlaceName: "Custom name" });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $set: { startPlaceName: "Custom name" } },
      { returnDocument: "after" },
    );
    expect(segment?.startPlaceName).toBe("Custom name");
  });

  it("returns null when the segment does not exist", async () => {
    findOneAndUpdate.mockResolvedValue(null);
    const { updateDriveSegment } = await import("./drive-segment");

    const segment = await updateDriveSegment(SEGMENT_ID, { startPlaceName: "x" });

    expect(segment).toBeNull();
  });
});
