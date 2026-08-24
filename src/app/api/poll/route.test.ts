import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAnyActiveTrip = vi.fn();
const startTrip = vi.fn();
const listVehicles = vi.fn();
const fetchVehicleSnapshot = vi.fn();
const pollTripOnce = vi.fn();

class TripAlreadyActiveError extends Error {}

vi.mock("@/lib/models/trip", () => ({
  getAnyActiveTrip: (...args: unknown[]) => getAnyActiveTrip(...args),
  startTrip: (...args: unknown[]) => startTrip(...args),
  TripAlreadyActiveError,
}));
vi.mock("@/lib/models/vehicle", () => ({
  listVehicles: (...args: unknown[]) => listVehicles(...args),
}));
vi.mock("@/lib/ha", () => ({
  fetchVehicleSnapshot: (...args: unknown[]) => fetchVehicleSnapshot(...args),
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
    startTrip.mockReset();
    listVehicles.mockReset().mockResolvedValue([]);
    fetchVehicleSnapshot.mockReset();
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

  it("no-ops when no trip is active and no vehicle is registered", async () => {
    getAnyActiveTrip.mockResolvedValue(null);
    listVehicles.mockResolvedValue([]);
    const { GET } = await import("./route");

    const response = await GET(request({ authorization: "Bearer shh" }));

    expect(response.status).toBe(200);
    expect(fetchVehicleSnapshot).not.toHaveBeenCalled();
    expect(pollTripOnce).not.toHaveBeenCalled();
  });

  it("checks each vehicle's HA state but starts nothing when none is in Drive", async () => {
    getAnyActiveTrip.mockResolvedValue(null);
    listVehicles.mockResolvedValue([
      { id: VEHICLE_ID, name: "Electra", entityPrefix: "electra", createdAt: "c" },
    ]);
    fetchVehicleSnapshot.mockResolvedValue({
      batteryLevel: 80,
      shiftState: "P",
      charging: false,
      pluggedIn: true,
      chargingState: "Disconnected",
      energyAdded: 0,
      odometer: 15230,
      chargerPower: 0,
      latitude: 44.5,
      longitude: 11.3,
    });

    const { GET } = await import("./route");
    const response = await GET(request({ authorization: "Bearer shh" }));

    expect(response.status).toBe(200);
    expect(fetchVehicleSnapshot).toHaveBeenCalledWith("electra");
    expect(startTrip).not.toHaveBeenCalled();
    expect(pollTripOnce).not.toHaveBeenCalled();
  });

  it("auto-starts a trip when an idle vehicle is found in Drive", async () => {
    getAnyActiveTrip.mockResolvedValue(null);
    listVehicles.mockResolvedValue([
      { id: VEHICLE_ID, name: "Electra", entityPrefix: "electra", createdAt: "c" },
    ]);
    fetchVehicleSnapshot.mockResolvedValue({
      batteryLevel: 80,
      shiftState: "D",
      charging: false,
      pluggedIn: false,
      chargingState: "Disconnected",
      energyAdded: 0,
      odometer: 15230,
      chargerPower: 0,
      latitude: 44.5,
      longitude: 11.3,
    });
    startTrip.mockResolvedValue({ id: TRIP_ID, vehicleId: VEHICLE_ID, startedAt: "s", endedAt: null });
    pollTripOnce.mockResolvedValue(undefined);

    const { GET } = await import("./route");
    const response = await GET(request({ authorization: "Bearer shh" }));

    expect(response.status).toBe(200);
    expect(startTrip).toHaveBeenCalledWith(VEHICLE_ID);
    expect(pollTripOnce).toHaveBeenCalledWith(TRIP_ID, VEHICLE_ID);
  });

  it("swallows a TripAlreadyActiveError race and keeps checking other vehicles", async () => {
    getAnyActiveTrip.mockResolvedValue(null);
    const otherVehicleId = "507f1f77bcf86cd799439022";
    listVehicles.mockResolvedValue([
      { id: VEHICLE_ID, name: "Electra", entityPrefix: "electra", createdAt: "c" },
      { id: otherVehicleId, name: "Other", entityPrefix: "other", createdAt: "c" },
    ]);
    fetchVehicleSnapshot.mockResolvedValue({
      batteryLevel: 80,
      shiftState: "D",
      charging: false,
      pluggedIn: false,
      chargingState: "Disconnected",
      energyAdded: 0,
      odometer: 15230,
      chargerPower: 0,
      latitude: 44.5,
      longitude: 11.3,
    });
    startTrip.mockRejectedValueOnce(new TripAlreadyActiveError("raced")).mockResolvedValueOnce({
      id: "trip2",
      vehicleId: otherVehicleId,
      startedAt: "s",
      endedAt: null,
    });
    pollTripOnce.mockResolvedValue(undefined);

    const { GET } = await import("./route");
    const response = await GET(request({ authorization: "Bearer shh" }));

    expect(response.status).toBe(200);
    expect(startTrip).toHaveBeenCalledTimes(2);
    expect(pollTripOnce).toHaveBeenCalledOnce();
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
