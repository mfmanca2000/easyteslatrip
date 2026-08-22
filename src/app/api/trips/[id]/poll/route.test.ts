import { beforeEach, describe, expect, it, vi } from "vitest";

const getTrip = vi.fn();
const pollTripOnce = vi.fn();

vi.mock("@/lib/models/trip", () => ({
  getTrip: (...args: unknown[]) => getTrip(...args),
}));
vi.mock("@/lib/domain/poll-trip", () => ({
  pollTripOnce: (...args: unknown[]) => pollTripOnce(...args),
}));

const TRIP_ID = "507f1f77bcf86cd799439099";
const VEHICLE_ID = "507f1f77bcf86cd799439011";

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/trips/[id]/poll", () => {
  beforeEach(() => {
    getTrip.mockReset();
    pollTripOnce.mockReset().mockResolvedValue(undefined);
  });

  it("rejects an invalid trip id", async () => {
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost"), params("not-an-id"));

    expect(response.status).toBe(400);
    expect(pollTripOnce).not.toHaveBeenCalled();
  });

  it("returns 404 when the trip does not exist", async () => {
    getTrip.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost"), params(TRIP_ID));

    expect(response.status).toBe(404);
    expect(pollTripOnce).not.toHaveBeenCalled();
  });

  it("no-ops without polling when the trip has already ended", async () => {
    getTrip.mockResolvedValue({ id: TRIP_ID, vehicleId: VEHICLE_ID, startedAt: "s", endedAt: "e" });
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost"), params(TRIP_ID));

    expect(response.status).toBe(204);
    expect(pollTripOnce).not.toHaveBeenCalled();
  });

  it("polls the trip once when it is active", async () => {
    getTrip.mockResolvedValue({ id: TRIP_ID, vehicleId: VEHICLE_ID, startedAt: "s", endedAt: null });
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost"), params(TRIP_ID));

    expect(response.status).toBe(204);
    expect(pollTripOnce).toHaveBeenCalledWith(TRIP_ID, VEHICLE_ID);
  });
});
