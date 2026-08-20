import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const listTrips = vi.fn();
const startTrip = vi.fn();

class FakeTripAlreadyActiveError extends Error {}

vi.mock("@/lib/models/trip", () => ({
  listTrips: (...args: unknown[]) => listTrips(...args),
  startTrip: (...args: unknown[]) => startTrip(...args),
  TripAlreadyActiveError: FakeTripAlreadyActiveError,
}));

const VEHICLE_ID = "507f1f77bcf86cd799439011";

describe("GET /api/trips", () => {
  it("returns trips for a vehicle", async () => {
    listTrips.mockResolvedValue([{ id: "trip1" }]);
    const { GET } = await import("./route");
    const request = new NextRequest(`http://localhost/api/trips?vehicleId=${VEHICLE_ID}`);

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.trips).toHaveLength(1);
    expect(listTrips).toHaveBeenCalledWith(VEHICLE_ID);
  });

  it("rejects a missing vehicleId", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/trips");

    const response = await GET(request);

    expect(response.status).toBe(400);
  });
});

describe("POST /api/trips", () => {
  it("starts a trip", async () => {
    startTrip.mockResolvedValue({ id: "trip1", vehicleId: VEHICLE_ID, startedAt: "now", endedAt: null });
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/trips", {
      method: "POST",
      body: JSON.stringify({ vehicleId: VEHICLE_ID }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.trip.id).toBe("trip1");
  });

  it("returns 409 when the vehicle already has an active trip", async () => {
    startTrip.mockRejectedValue(new FakeTripAlreadyActiveError("already active"));
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/trips", {
      method: "POST",
      body: JSON.stringify({ vehicleId: VEHICLE_ID }),
    });

    const response = await POST(request);

    expect(response.status).toBe(409);
  });

  it("rejects an invalid vehicleId", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/trips", {
      method: "POST",
      body: JSON.stringify({ vehicleId: "not-an-id" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("rejects a malformed request body", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/trips", {
      method: "POST",
      body: "not json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
