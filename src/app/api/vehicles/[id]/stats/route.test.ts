import { describe, expect, it, vi } from "vitest";

const getVehicleById = vi.fn();
const listTrips = vi.fn();
const listDriveSegmentsByTripIds = vi.fn();
const listChargeSessionsByTripIds = vi.fn();

vi.mock("@/lib/models/vehicle", () => ({
  getVehicleById: (...args: unknown[]) => getVehicleById(...args),
}));
vi.mock("@/lib/models/trip", () => ({
  listTrips: (...args: unknown[]) => listTrips(...args),
}));
vi.mock("@/lib/models/drive-segment", () => ({
  listDriveSegmentsByTripIds: (...args: unknown[]) => listDriveSegmentsByTripIds(...args),
}));
vi.mock("@/lib/models/charge-session", () => ({
  listChargeSessionsByTripIds: (...args: unknown[]) => listChargeSessionsByTripIds(...args),
}));

const VEHICLE_ID = "507f1f77bcf86cd799439011";
const TRIP_ID_1 = "507f1f77bcf86cd799439021";
const TRIP_ID_2 = "507f1f77bcf86cd799439022";

describe("GET /api/vehicles/[id]/stats", () => {
  it("returns 400 for an invalid vehicle id", async () => {
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "not-an-id" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 when the vehicle does not exist", async () => {
    getVehicleById.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: VEHICLE_ID }),
    });

    expect(response.status).toBe(404);
  });

  it("aggregates only completed trips, excluding any still-active trip", async () => {
    getVehicleById.mockResolvedValue({ id: VEHICLE_ID, name: "Electra", entityPrefix: "electra", createdAt: "c" });
    listTrips.mockResolvedValue([
      { id: TRIP_ID_1, vehicleId: VEHICLE_ID, startedAt: "s1", endedAt: "e1" },
      { id: TRIP_ID_2, vehicleId: VEHICLE_ID, startedAt: "s2", endedAt: null },
    ]);
    listDriveSegmentsByTripIds.mockResolvedValue([
      { startedAt: "2026-08-20T07:00:00.000Z", endedAt: "2026-08-20T08:00:00.000Z", distanceKm: 100 },
    ]);
    listChargeSessionsByTripIds.mockResolvedValue([]);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: VEHICLE_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listDriveSegmentsByTripIds).toHaveBeenCalledWith([TRIP_ID_1]);
    expect(listChargeSessionsByTripIds).toHaveBeenCalledWith([TRIP_ID_1]);
    expect(body.stats.tripCount).toBe(1);
    expect(body.stats.distanceKm).toBe(100);
  });
});
