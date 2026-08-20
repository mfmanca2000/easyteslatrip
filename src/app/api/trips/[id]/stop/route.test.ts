import { describe, expect, it, vi } from "vitest";

const stopTrip = vi.fn();

vi.mock("@/lib/models/trip", () => ({
  stopTrip: (...args: unknown[]) => stopTrip(...args),
}));

const TRIP_ID = "507f1f77bcf86cd799439099";

describe("POST /api/trips/[id]/stop", () => {
  it("stops the trip", async () => {
    stopTrip.mockResolvedValue({ id: TRIP_ID, vehicleId: "v1", startedAt: "s", endedAt: "e" });
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: TRIP_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.trip.endedAt).toBe("e");
  });

  it("returns 404 when the trip is not active", async () => {
    stopTrip.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: TRIP_ID }),
    });

    expect(response.status).toBe(404);
  });

  it("rejects an invalid trip id", async () => {
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "not-an-id" }),
    });

    expect(response.status).toBe(400);
  });
});
