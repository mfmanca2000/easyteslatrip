import { beforeEach, describe, expect, it, vi } from "vitest";

const findOne = vi.fn();
const updateOne = vi.fn();
const deleteOne = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    collection: () => ({
      findOne,
      updateOne,
      deleteOne,
    }),
  }),
}));

const TRIP_ID = "507f1f77bcf86cd799439099";

describe("getRouteLog", () => {
  beforeEach(() => {
    findOne.mockReset();
  });

  it("returns the stored points", async () => {
    findOne.mockResolvedValue({ points: [{ latitude: 44.5, longitude: 11.3, recordedAt: new Date() }] });
    const { getRouteLog } = await import("./route-log");

    const points = await getRouteLog(TRIP_ID);

    expect(points).toHaveLength(1);
  });

  it("returns an empty array when no route log exists yet", async () => {
    findOne.mockResolvedValue(null);
    const { getRouteLog } = await import("./route-log");

    const points = await getRouteLog(TRIP_ID);

    expect(points).toEqual([]);
  });
});

describe("replaceRouteLog", () => {
  it("upserts the full points array for the trip", async () => {
    updateOne.mockResolvedValue({ acknowledged: true });
    const { replaceRouteLog } = await import("./route-log");

    const points = [{ latitude: 44.5, longitude: 11.3, recordedAt: new Date() }];
    await replaceRouteLog(TRIP_ID, points);

    expect(updateOne).toHaveBeenCalledWith(
      { tripId: expect.anything() },
      { $set: { points } },
      { upsert: true },
    );
  });
});

describe("deleteRouteLog", () => {
  it("deletes the route log for the trip", async () => {
    deleteOne.mockResolvedValue({ acknowledged: true });
    const { deleteRouteLog } = await import("./route-log");

    await deleteRouteLog(TRIP_ID);

    expect(deleteOne).toHaveBeenCalledWith({ tripId: expect.anything() });
  });
});
