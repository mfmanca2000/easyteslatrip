import { beforeEach, describe, expect, it, vi } from "vitest";

const insertOne = vi.fn();
const sort = vi.fn();
const find = vi.fn(() => ({ sort }));
const findOneAndUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    collection: () => ({
      insertOne,
      find,
      findOneAndUpdate,
    }),
  }),
}));

describe("listVehicles", () => {
  it("returns vehicles sorted by name", async () => {
    sort.mockReturnValue({
      toArray: () =>
        Promise.resolve([
          {
            _id: { toHexString: () => "veh1" },
            name: "Electra",
            entityPrefix: "electra",
            batteryCapacityKwh: 75,
            createdAt: new Date("2026-08-20T00:00:00.000Z"),
          },
        ]),
    });
    const { listVehicles } = await import("./vehicle");

    const vehicles = await listVehicles();

    expect(vehicles).toEqual([
      {
        id: "veh1",
        name: "Electra",
        entityPrefix: "electra",
        batteryCapacityKwh: 75,
        createdAt: "2026-08-20T00:00:00.000Z",
      },
    ]);
    expect(sort).toHaveBeenCalledWith({ name: 1 });
  });
});

describe("createVehicle", () => {
  beforeEach(() => {
    insertOne.mockReset();
  });

  it("inserts a vehicle and returns it", async () => {
    insertOne.mockResolvedValue({ acknowledged: true });
    const { createVehicle } = await import("./vehicle");

    const vehicle = await createVehicle({ name: "Electra", entityPrefix: "electra", batteryCapacityKwh: 75 });

    expect(vehicle.name).toBe("Electra");
    expect(vehicle.entityPrefix).toBe("electra");
    expect(vehicle.batteryCapacityKwh).toBe(75);
    expect(typeof vehicle.id).toBe("string");
  });

  it("defaults battery capacity to null when not given", async () => {
    insertOne.mockResolvedValue({ acknowledged: true });
    const { createVehicle } = await import("./vehicle");

    const vehicle = await createVehicle({ name: "Electra", entityPrefix: "electra" });

    expect(vehicle.batteryCapacityKwh).toBeNull();
  });
});

describe("updateVehicle", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
  });

  const VEHICLE_ID = "507f1f77bcf86cd799439011";

  it("applies the patch and returns the updated vehicle", async () => {
    findOneAndUpdate.mockResolvedValue({
      _id: { toHexString: () => VEHICLE_ID },
      name: "Electra",
      entityPrefix: "electra",
      batteryCapacityKwh: 82,
      createdAt: new Date("2026-08-20T00:00:00.000Z"),
    });
    const { updateVehicle } = await import("./vehicle");

    const vehicle = await updateVehicle(VEHICLE_ID, { batteryCapacityKwh: 82 });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $set: { batteryCapacityKwh: 82 } },
      { returnDocument: "after" },
    );
    expect(vehicle?.batteryCapacityKwh).toBe(82);
  });

  it("returns null when the vehicle does not exist", async () => {
    findOneAndUpdate.mockResolvedValue(null);
    const { updateVehicle } = await import("./vehicle");

    const vehicle = await updateVehicle(VEHICLE_ID, { batteryCapacityKwh: 82 });

    expect(vehicle).toBeNull();
  });
});
