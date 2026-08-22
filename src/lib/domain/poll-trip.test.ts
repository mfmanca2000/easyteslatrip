import { beforeEach, describe, expect, it, vi } from "vitest";

const getVehicleById = vi.fn();
const createPollSnapshot = vi.fn();
const fetchVehicleSnapshot = vi.fn();
const syncTripDerivedData = vi.fn();

vi.mock("@/lib/models/vehicle", () => ({
  getVehicleById: (...args: unknown[]) => getVehicleById(...args),
}));
vi.mock("@/lib/models/poll-snapshot", () => ({
  createPollSnapshot: (...args: unknown[]) => createPollSnapshot(...args),
}));
vi.mock("@/lib/ha", () => ({
  fetchVehicleSnapshot: (...args: unknown[]) => fetchVehicleSnapshot(...args),
}));
vi.mock("@/lib/domain/sync-trip-derived-data", () => ({
  syncTripDerivedData: (...args: unknown[]) => syncTripDerivedData(...args),
}));

const TRIP_ID = "507f1f77bcf86cd799439099";
const VEHICLE_ID = "507f1f77bcf86cd799439011";

const snapshotFields = {
  batteryLevel: 77,
  shiftState: "D",
  charging: false,
  pluggedIn: false,
  chargingState: "Disconnected",
  energyAdded: 0,
  odometer: 15230,
  chargerPower: 0,
  latitude: 44.5,
  longitude: 11.3,
};

describe("pollTripOnce", () => {
  beforeEach(() => {
    getVehicleById.mockReset();
    createPollSnapshot.mockReset();
    fetchVehicleSnapshot.mockReset();
    syncTripDerivedData.mockReset();
  });

  it("fetches an HA snapshot, writes it, and syncs derived data", async () => {
    getVehicleById.mockResolvedValue({
      id: VEHICLE_ID,
      name: "Electra",
      entityPrefix: "electra",
      createdAt: "c",
    });
    fetchVehicleSnapshot.mockResolvedValue(snapshotFields);
    createPollSnapshot.mockResolvedValue({ id: "snap1", tripId: TRIP_ID, vehicleId: VEHICLE_ID, ...snapshotFields });

    const { pollTripOnce } = await import("./poll-trip");
    await pollTripOnce(TRIP_ID, VEHICLE_ID);

    expect(fetchVehicleSnapshot).toHaveBeenCalledWith("electra");
    expect(createPollSnapshot).toHaveBeenCalledWith({
      tripId: TRIP_ID,
      vehicleId: VEHICLE_ID,
      ...snapshotFields,
    });
    expect(syncTripDerivedData).toHaveBeenCalledWith(TRIP_ID, VEHICLE_ID);
  });

  it("swallows a derived-data sync failure after the snapshot is written", async () => {
    getVehicleById.mockResolvedValue({
      id: VEHICLE_ID,
      name: "Electra",
      entityPrefix: "electra",
      createdAt: "c",
    });
    fetchVehicleSnapshot.mockResolvedValue(snapshotFields);
    createPollSnapshot.mockResolvedValue({ id: "snap1" });
    syncTripDerivedData.mockRejectedValue(new Error("Mapbox request failed: 500"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { pollTripOnce } = await import("./poll-trip");
    await expect(pollTripOnce(TRIP_ID, VEHICLE_ID)).resolves.toBeUndefined();

    expect(createPollSnapshot).toHaveBeenCalledOnce();
    consoleErrorSpy.mockRestore();
  });

  it("propagates an HA fetch failure", async () => {
    getVehicleById.mockResolvedValue({
      id: VEHICLE_ID,
      name: "Electra",
      entityPrefix: "electra",
      createdAt: "c",
    });
    fetchVehicleSnapshot.mockRejectedValue(new Error("HA request failed for sensor.electra_battery: 502"));

    const { pollTripOnce } = await import("./poll-trip");

    await expect(pollTripOnce(TRIP_ID, VEHICLE_ID)).rejects.toThrow("HA request failed");
    expect(createPollSnapshot).not.toHaveBeenCalled();
  });
});
