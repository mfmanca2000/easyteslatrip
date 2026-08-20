import { beforeEach, describe, expect, it, vi } from "vitest";

const listPollSnapshotsByTrip = vi.fn();
const listDriveSegmentsByTrip = vi.fn();
const saveDriveSegments = vi.fn();
const listChargeSessionsByTrip = vi.fn();
const saveChargeSessions = vi.fn();
const replaceRouteLog = vi.fn();
const reverseGeocode = vi.fn();

vi.mock("@/lib/models/poll-snapshot", () => ({
  listPollSnapshotsByTrip: (...args: unknown[]) => listPollSnapshotsByTrip(...args),
}));
vi.mock("@/lib/models/drive-segment", () => ({
  listDriveSegmentsByTrip: (...args: unknown[]) => listDriveSegmentsByTrip(...args),
  saveDriveSegments: (...args: unknown[]) => saveDriveSegments(...args),
}));
vi.mock("@/lib/models/charge-session", () => ({
  listChargeSessionsByTrip: (...args: unknown[]) => listChargeSessionsByTrip(...args),
  saveChargeSessions: (...args: unknown[]) => saveChargeSessions(...args),
}));
vi.mock("@/lib/models/route-log", () => ({
  replaceRouteLog: (...args: unknown[]) => replaceRouteLog(...args),
}));
vi.mock("@/lib/geocode", () => ({
  reverseGeocode: (...args: unknown[]) => reverseGeocode(...args),
}));

const TRIP_ID = "507f1f77bcf86cd799439099";
const VEHICLE_ID = "507f1f77bcf86cd799439011";

function pollSnapshot(overrides: Record<string, unknown>) {
  return {
    id: "snap",
    tripId: TRIP_ID,
    vehicleId: VEHICLE_ID,
    polledAt: "2026-08-20T07:00:00.000Z",
    batteryLevel: 80,
    shiftState: "P",
    charging: false,
    pluggedIn: false,
    chargingState: "Disconnected",
    energyAdded: 0,
    odometer: 15000,
    chargerPower: 0,
    latitude: 44.5,
    longitude: 11.3,
    ...overrides,
  };
}

describe("syncTripDerivedData", () => {
  beforeEach(() => {
    listPollSnapshotsByTrip.mockReset();
    listDriveSegmentsByTrip.mockReset().mockResolvedValue([]);
    saveDriveSegments.mockReset();
    listChargeSessionsByTrip.mockReset().mockResolvedValue([]);
    saveChargeSessions.mockReset();
    replaceRouteLog.mockReset();
    reverseGeocode.mockReset().mockResolvedValue("Bologna, Italy");
  });

  it("geocodes a newly-closed drive segment and saves it", async () => {
    listPollSnapshotsByTrip.mockResolvedValue([
      pollSnapshot({ shiftState: "D", odometer: 15000, polledAt: "2026-08-20T07:00:00.000Z" }),
      pollSnapshot({ shiftState: "P", odometer: 15010, polledAt: "2026-08-20T07:05:00.000Z" }),
      pollSnapshot({ shiftState: "P", odometer: 15010, polledAt: "2026-08-20T07:10:00.000Z" }),
    ]);
    const { syncTripDerivedData } = await import("./sync-trip-derived-data");

    await syncTripDerivedData(TRIP_ID, VEHICLE_ID);

    expect(reverseGeocode).toHaveBeenCalledTimes(2); // start + end
    expect(saveDriveSegments).toHaveBeenCalledOnce();
    const saved = saveDriveSegments.mock.calls[0][2];
    expect(saved).toHaveLength(1);
    expect(saved[0].startPlaceName).toBe("Bologna, Italy");
    expect(saved[0].endPlaceName).toBe("Bologna, Italy");
  });

  it("does not geocode a still-open drive segment", async () => {
    listPollSnapshotsByTrip.mockResolvedValue([
      pollSnapshot({ shiftState: "D", odometer: 15000 }),
    ]);
    const { syncTripDerivedData } = await import("./sync-trip-derived-data");

    await syncTripDerivedData(TRIP_ID, VEHICLE_ID);

    expect(reverseGeocode).not.toHaveBeenCalled();
    const saved = saveDriveSegments.mock.calls[0][2];
    expect(saved[0].startPlaceName).toBeNull();
  });

  it("reuses a previously-resolved place name instead of geocoding again", async () => {
    listPollSnapshotsByTrip.mockResolvedValue([
      pollSnapshot({ shiftState: "D", odometer: 15000, polledAt: "2026-08-20T07:00:00.000Z" }),
      pollSnapshot({ shiftState: "P", odometer: 15010, polledAt: "2026-08-20T07:05:00.000Z" }),
      pollSnapshot({ shiftState: "P", odometer: 15010, polledAt: "2026-08-20T07:10:00.000Z" }),
    ]);
    listDriveSegmentsByTrip.mockResolvedValue([
      {
        id: "seg1",
        tripId: TRIP_ID,
        vehicleId: VEHICLE_ID,
        startedAt: "2026-08-20T07:00:00.000Z",
        endedAt: "2026-08-20T07:05:00.000Z",
        startOdometer: 15000,
        endOdometer: 15010,
        distanceKm: 10,
        startLatitude: 44.5,
        startLongitude: 11.3,
        endLatitude: 44.5,
        endLongitude: 11.3,
        startPlaceName: "Already Resolved",
        endPlaceName: "Already Resolved End",
      },
    ]);
    const { syncTripDerivedData } = await import("./sync-trip-derived-data");

    await syncTripDerivedData(TRIP_ID, VEHICLE_ID);

    expect(reverseGeocode).not.toHaveBeenCalled();
    const saved = saveDriveSegments.mock.calls[0][2];
    expect(saved[0].startPlaceName).toBe("Already Resolved");
    expect(saved[0].endPlaceName).toBe("Already Resolved End");
  });

  it("geocodes a newly-closed charge session once and saves it", async () => {
    listPollSnapshotsByTrip.mockResolvedValue([
      pollSnapshot({ chargingState: "Charging", batteryLevel: 40, polledAt: "2026-08-20T07:00:00.000Z" }),
      pollSnapshot({
        chargingState: "Complete",
        batteryLevel: 90,
        energyAdded: 35,
        polledAt: "2026-08-20T08:00:00.000Z",
      }),
    ]);
    const { syncTripDerivedData } = await import("./sync-trip-derived-data");

    await syncTripDerivedData(TRIP_ID, VEHICLE_ID);

    expect(reverseGeocode).toHaveBeenCalledTimes(1);
    const saved = saveChargeSessions.mock.calls[0][2];
    expect(saved).toHaveLength(1);
    expect(saved[0].placeName).toBe("Bologna, Italy");
  });

  it("always replaces the route log with every point", async () => {
    listPollSnapshotsByTrip.mockResolvedValue([
      pollSnapshot({ polledAt: "2026-08-20T07:00:00.000Z" }),
      pollSnapshot({ polledAt: "2026-08-20T09:00:00.000Z" }),
    ]);
    const { syncTripDerivedData } = await import("./sync-trip-derived-data");

    await syncTripDerivedData(TRIP_ID, VEHICLE_ID);

    expect(replaceRouteLog).toHaveBeenCalledWith(TRIP_ID, expect.arrayContaining([
      expect.objectContaining({ latitude: 44.5 }),
    ]));
    expect(replaceRouteLog.mock.calls[0][1]).toHaveLength(2);
  });
});
