import { describe, expect, it, vi } from "vitest";

const getTrip = vi.fn();
const getVehicleById = vi.fn();
const listDriveSegmentsByTrip = vi.fn();
const listChargeSessionsByTrip = vi.fn();
const getRouteLog = vi.fn();
const listPollSnapshotsByTrip = vi.fn();

vi.mock("@/lib/models/trip", () => ({
  getTrip: (...args: unknown[]) => getTrip(...args),
}));
vi.mock("@/lib/models/vehicle", () => ({
  getVehicleById: (...args: unknown[]) => getVehicleById(...args),
}));
vi.mock("@/lib/models/drive-segment", () => ({
  listDriveSegmentsByTrip: (...args: unknown[]) => listDriveSegmentsByTrip(...args),
}));
vi.mock("@/lib/models/charge-session", () => ({
  listChargeSessionsByTrip: (...args: unknown[]) => listChargeSessionsByTrip(...args),
}));
vi.mock("@/lib/models/route-log", () => ({
  getRouteLog: (...args: unknown[]) => getRouteLog(...args),
}));
vi.mock("@/lib/models/poll-snapshot", () => ({
  listPollSnapshotsByTrip: (...args: unknown[]) => listPollSnapshotsByTrip(...args),
}));

const TRIP_ID = "507f1f77bcf86cd799439099";
const VEHICLE_ID = "507f1f77bcf86cd799439011";

describe("GET /api/trips/[id]", () => {
  it("returns 400 for an invalid trip id", async () => {
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "not-an-id" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 when the trip does not exist", async () => {
    getTrip.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: TRIP_ID }),
    });

    expect(response.status).toBe(404);
  });

  it("assembles the trip detail payload with totals", async () => {
    getTrip.mockResolvedValue({ id: TRIP_ID, vehicleId: VEHICLE_ID, startedAt: "s", endedAt: "e" });
    getVehicleById.mockResolvedValue({ id: VEHICLE_ID, name: "Electra", entityPrefix: "electra", createdAt: "c" });
    listDriveSegmentsByTrip.mockResolvedValue([
      {
        id: "seg1",
        tripId: TRIP_ID,
        vehicleId: VEHICLE_ID,
        startedAt: "2026-08-20T07:00:00.000Z",
        endedAt: "2026-08-20T08:00:00.000Z",
        startOdometer: 15000,
        endOdometer: 15100,
        distanceKm: 100,
        startLatitude: 44.5,
        startLongitude: 11.3,
        endLatitude: 44.6,
        endLongitude: 11.4,
        startPlaceName: "Bologna",
        endPlaceName: "Modena",
      },
    ]);
    listChargeSessionsByTrip.mockResolvedValue([]);
    getRouteLog.mockResolvedValue([{ latitude: 44.5, longitude: 11.3, recordedAt: new Date("2026-08-20T07:00:00.000Z") }]);
    listPollSnapshotsByTrip.mockResolvedValue([
      { id: "p1", tripId: TRIP_ID, vehicleId: VEHICLE_ID, polledAt: "2026-08-20T07:00:00.000Z", batteryLevel: 80, shiftState: "D", charging: false, pluggedIn: false, chargingState: "Disconnected", energyAdded: 0, odometer: 15000, chargerPower: 0, latitude: 44.5, longitude: 11.3 },
    ]);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: TRIP_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.trip.id).toBe(TRIP_ID);
    expect(body.vehicle.name).toBe("Electra");
    expect(body.driveSegments).toHaveLength(1);
    expect(body.routeLog).toHaveLength(1);
    expect(body.batterySeries).toEqual([{ polledAt: "2026-08-20T07:00:00.000Z", batteryLevel: 80, odometer: 15000 }]);
    expect(body.totals.distanceKm).toBe(100);
    expect(body.totals.drivingMinutes).toBe(60);
  });
});
