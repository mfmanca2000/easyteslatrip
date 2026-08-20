import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteVehicle = vi.fn();
const listTrips = vi.fn();
const deleteTripCascade = vi.fn();

vi.mock("@/lib/models/vehicle", () => ({
  deleteVehicle: (...args: unknown[]) => deleteVehicle(...args),
}));
vi.mock("@/lib/models/trip", () => ({
  listTrips: (...args: unknown[]) => listTrips(...args),
}));
vi.mock("@/lib/domain/delete-trip", () => ({
  deleteTripCascade: (...args: unknown[]) => deleteTripCascade(...args),
}));

const VEHICLE_ID = "507f1f77bcf86cd799439011";

describe("deleteVehicleCascade", () => {
  beforeEach(() => {
    deleteVehicle.mockReset();
    listTrips.mockReset();
    deleteTripCascade.mockReset().mockResolvedValue(true);
  });

  it("cascades delete across every trip and then the vehicle, returning true when the vehicle existed", async () => {
    listTrips.mockResolvedValue([{ id: "trip1" }, { id: "trip2" }]);
    deleteVehicle.mockResolvedValue(true);
    const { deleteVehicleCascade } = await import("./delete-vehicle");

    const result = await deleteVehicleCascade(VEHICLE_ID);

    expect(result).toBe(true);
    expect(listTrips).toHaveBeenCalledWith(VEHICLE_ID);
    expect(deleteTripCascade).toHaveBeenCalledWith("trip1");
    expect(deleteTripCascade).toHaveBeenCalledWith("trip2");
    expect(deleteVehicle).toHaveBeenCalledWith(VEHICLE_ID);
  });

  it("deletes the vehicle even when it has no trips", async () => {
    listTrips.mockResolvedValue([]);
    deleteVehicle.mockResolvedValue(true);
    const { deleteVehicleCascade } = await import("./delete-vehicle");

    await expect(deleteVehicleCascade(VEHICLE_ID)).resolves.toBe(true);
    expect(deleteTripCascade).not.toHaveBeenCalled();
  });

  it("returns false when the vehicle did not exist", async () => {
    listTrips.mockResolvedValue([]);
    deleteVehicle.mockResolvedValue(false);
    const { deleteVehicleCascade } = await import("./delete-vehicle");

    await expect(deleteVehicleCascade(VEHICLE_ID)).resolves.toBe(false);
  });
});
