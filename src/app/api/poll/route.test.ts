import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAnyActiveTrip = vi.fn();
const getVehicleById = vi.fn();
const createPollSnapshot = vi.fn();
const fetchVehicleSnapshot = vi.fn();

vi.mock("@/lib/models/trip", () => ({
  getAnyActiveTrip: (...args: unknown[]) => getAnyActiveTrip(...args),
}));
vi.mock("@/lib/models/vehicle", () => ({
  getVehicleById: (...args: unknown[]) => getVehicleById(...args),
}));
vi.mock("@/lib/models/poll-snapshot", () => ({
  createPollSnapshot: (...args: unknown[]) => createPollSnapshot(...args),
}));
vi.mock("@/lib/ha", () => ({
  fetchVehicleSnapshot: (...args: unknown[]) => fetchVehicleSnapshot(...args),
}));

const TRIP_ID = "507f1f77bcf86cd799439099";
const VEHICLE_ID = "507f1f77bcf86cd799439011";

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/poll", { headers });
}

describe("GET/HEAD /api/poll", () => {
  beforeEach(() => {
    getAnyActiveTrip.mockReset();
    getVehicleById.mockReset();
    createPollSnapshot.mockReset();
    fetchVehicleSnapshot.mockReset();
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

  it("no-ops without calling HA when no trip is active for any vehicle", async () => {
    getAnyActiveTrip.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(request({ authorization: "Bearer shh" }));

    expect(response.status).toBe(200);
    expect(fetchVehicleSnapshot).not.toHaveBeenCalled();
    expect(createPollSnapshot).not.toHaveBeenCalled();
  });

  it("polls HA and writes a snapshot when a trip is active", async () => {
    getAnyActiveTrip.mockResolvedValue({
      id: TRIP_ID,
      vehicleId: VEHICLE_ID,
      startedAt: "s",
      endedAt: null,
    });
    getVehicleById.mockResolvedValue({
      id: VEHICLE_ID,
      name: "Electra",
      entityPrefix: "electra",
      createdAt: "c",
    });
    const snapshotFields = {
      batteryLevel: 77,
      shiftState: "D",
      charging: false,
      pluggedIn: false,
      energyAdded: 0,
      odometer: 15230,
      chargerPower: 0,
      latitude: 44.5,
      longitude: 11.3,
    };
    fetchVehicleSnapshot.mockResolvedValue(snapshotFields);
    createPollSnapshot.mockResolvedValue({ id: "snap1", tripId: TRIP_ID, vehicleId: VEHICLE_ID, ...snapshotFields });

    const { GET } = await import("./route");
    const response = await GET(request({ authorization: "Bearer shh" }));

    expect(response.status).toBe(200);
    expect(fetchVehicleSnapshot).toHaveBeenCalledWith("electra");
    expect(createPollSnapshot).toHaveBeenCalledWith({
      tripId: TRIP_ID,
      vehicleId: VEHICLE_ID,
      ...snapshotFields,
    });
  });

  it("exposes the same handler for HEAD requests", async () => {
    const { GET, HEAD } = await import("./route");

    expect(HEAD).toBe(GET);
  });
});
