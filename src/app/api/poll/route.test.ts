import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAnyActiveTrip = vi.fn();
const pollTripOnce = vi.fn();

vi.mock("@/lib/models/trip", () => ({
  getAnyActiveTrip: (...args: unknown[]) => getAnyActiveTrip(...args),
}));
vi.mock("@/lib/domain/poll-trip", () => ({
  pollTripOnce: (...args: unknown[]) => pollTripOnce(...args),
}));

const TRIP_ID = "507f1f77bcf86cd799439099";
const VEHICLE_ID = "507f1f77bcf86cd799439011";

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/poll", { headers });
}

describe("GET/HEAD /api/poll", () => {
  beforeEach(() => {
    getAnyActiveTrip.mockReset();
    pollTripOnce.mockReset();
    vi.stubEnv("POLL_TRIGGER_SECRET", "shh");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a missing bearer secret", async () => {
    const { GET } = await import("./route");

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(getAnyActiveTrip).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer secret", async () => {
    const { GET } = await import("./route");

    const response = await GET(request({ authorization: "Bearer wrong" }));

    expect(response.status).toBe(401);
    expect(getAnyActiveTrip).not.toHaveBeenCalled();
  });

  it("no-ops without polling when no trip is active for any vehicle", async () => {
    getAnyActiveTrip.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(request({ authorization: "Bearer shh" }));

    expect(response.status).toBe(200);
    expect(pollTripOnce).not.toHaveBeenCalled();
  });

  it("polls the active trip once when one is active", async () => {
    getAnyActiveTrip.mockResolvedValue({
      id: TRIP_ID,
      vehicleId: VEHICLE_ID,
      startedAt: "s",
      endedAt: null,
    });
    pollTripOnce.mockResolvedValue(undefined);

    const { GET } = await import("./route");
    const response = await GET(request({ authorization: "Bearer shh" }));

    expect(response.status).toBe(200);
    expect(pollTripOnce).toHaveBeenCalledWith(TRIP_ID, VEHICLE_ID);
  });

  it("exposes the same handler for HEAD requests", async () => {
    const { GET, HEAD } = await import("./route");

    expect(HEAD).toBe(GET);
  });
});
