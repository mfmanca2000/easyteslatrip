import { beforeEach, describe, expect, it, vi } from "vitest";

const insertOne = vi.fn();
const sort = vi.fn();
const find = vi.fn(() => ({ sort }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    collection: () => ({
      insertOne,
      find,
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

    const vehicle = await createVehicle({ name: "Electra", entityPrefix: "electra" });

    expect(vehicle.name).toBe("Electra");
    expect(vehicle.entityPrefix).toBe("electra");
    expect(typeof vehicle.id).toBe("string");
  });
});
