import { beforeEach, describe, expect, it, vi } from "vitest";

const getVehicleById = vi.fn();
const createPollSnapshot = vi.fn();
const fetchVehicleSnapshot = vi.fn();
const syncTripDerivedData = vi.fn();
const listDriveSegmentsByTrip = vi.fn();
const stopTrip = vi.fn();

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
vi.mock("@/lib/models/drive-segment", () => ({
  listDriveSegmentsByTrip: (...args: unknown[]) => listDriveSegmentsByTrip(...args),
}));
vi.mock("@/lib/models/trip", () => ({
  stopTrip: (...args: unknown[]) => stopTrip(...args),
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
    listDriveSegmentsByTrip.mockReset().mockResolvedValue([]);
    stopTrip.mockReset();
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

describe("pollTripOnce auto-stop on sustained P", () => {
  const parkedSnapshot = { ...snapshotFields, shiftState: "P" };

  function segmentEndedMinutesAgo(minutes: number) {
    return [
      {
        id: "seg1",
        endedAt: new Date(Date.now() - minutes * 60 * 1000).toISOString(),
      },
    ];
  }

  beforeEach(() => {
    getVehicleById.mockReset().mockResolvedValue({
      id: VEHICLE_ID,
      name: "Electra",
      entityPrefix: "electra",
      createdAt: "c",
    });
    createPollSnapshot.mockReset().mockResolvedValue({ id: "snap1" });
    fetchVehicleSnapshot.mockReset().mockResolvedValue(parkedSnapshot);
    syncTripDerivedData.mockReset().mockResolvedValue(undefined);
    listDriveSegmentsByTrip.mockReset();
    stopTrip.mockReset();
  });

  it("stops the trip once the last DriveSegment closed at least 20 minutes ago", async () => {
    listDriveSegmentsByTrip.mockResolvedValue(segmentEndedMinutesAgo(21));
    stopTrip.mockResolvedValue({ id: TRIP_ID, vehicleId: VEHICLE_ID, startedAt: "s", endedAt: "e" });

    const { pollTripOnce } = await import("./poll-trip");
    await pollTripOnce(TRIP_ID, VEHICLE_ID);

    expect(stopTrip).toHaveBeenCalledWith(TRIP_ID);
    expect(syncTripDerivedData).toHaveBeenCalledWith(TRIP_ID, VEHICLE_ID, { tripEnded: true });
  });

  it("does not stop the trip before the 20-minute grace since the leg closed elapses", async () => {
    listDriveSegmentsByTrip.mockResolvedValue(segmentEndedMinutesAgo(5));

    const { pollTripOnce } = await import("./poll-trip");
    await pollTripOnce(TRIP_ID, VEHICLE_ID);

    expect(stopTrip).not.toHaveBeenCalled();
  });

  it("does not stop the trip while a DriveSegment is still open", async () => {
    listDriveSegmentsByTrip.mockResolvedValue([{ id: "seg1", endedAt: null }]);

    const { pollTripOnce } = await import("./poll-trip");
    await pollTripOnce(TRIP_ID, VEHICLE_ID);

    expect(stopTrip).not.toHaveBeenCalled();
  });

  it("does not stop a trip with no closed DriveSegment yet", async () => {
    listDriveSegmentsByTrip.mockResolvedValue([]);

    const { pollTripOnce } = await import("./poll-trip");
    await pollTripOnce(TRIP_ID, VEHICLE_ID);

    expect(stopTrip).not.toHaveBeenCalled();
    expect(listDriveSegmentsByTrip).toHaveBeenCalledWith(TRIP_ID);
  });

  it("does not check for auto-stop when the vehicle is not in P", async () => {
    fetchVehicleSnapshot.mockResolvedValue({ ...snapshotFields, shiftState: "D" });

    const { pollTripOnce } = await import("./poll-trip");
    await pollTripOnce(TRIP_ID, VEHICLE_ID);

    expect(listDriveSegmentsByTrip).not.toHaveBeenCalled();
    expect(stopTrip).not.toHaveBeenCalled();
  });

  it("does not double-stop when a concurrent manual stop already ended the trip", async () => {
    listDriveSegmentsByTrip.mockResolvedValue(segmentEndedMinutesAgo(30));
    stopTrip.mockResolvedValue(null);

    const { pollTripOnce } = await import("./poll-trip");
    await pollTripOnce(TRIP_ID, VEHICLE_ID);

    expect(stopTrip).toHaveBeenCalledWith(TRIP_ID);
    expect(syncTripDerivedData).toHaveBeenCalledWith(TRIP_ID, VEHICLE_ID); // the pre-stop sync only
    expect(syncTripDerivedData).not.toHaveBeenCalledWith(TRIP_ID, VEHICLE_ID, { tripEnded: true });
  });

  it("swallows a derived-data sync failure that happens after auto-stop", async () => {
    listDriveSegmentsByTrip.mockResolvedValue(segmentEndedMinutesAgo(25));
    stopTrip.mockResolvedValue({ id: TRIP_ID, vehicleId: VEHICLE_ID, startedAt: "s", endedAt: "e" });
    syncTripDerivedData
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Mapbox request failed: 500"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { pollTripOnce } = await import("./poll-trip");
    await expect(pollTripOnce(TRIP_ID, VEHICLE_ID)).resolves.toBeUndefined();

    consoleErrorSpy.mockRestore();
  });
});
