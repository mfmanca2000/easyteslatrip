import { describe, expect, it, vi } from "vitest";

const updateVehicle = vi.fn();

vi.mock("@/lib/models/vehicle", () => ({
  updateVehicle: (...args: unknown[]) => updateVehicle(...args),
}));

const VEHICLE_ID = "507f1f77bcf86cd799439011";

function patchRequest(body: unknown) {
  return new Request("http://localhost", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/vehicles/[id]", () => {
  it("updates the battery capacity", async () => {
    updateVehicle.mockResolvedValue({ id: VEHICLE_ID, batteryCapacityKwh: 75 });
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ batteryCapacityKwh: 75 }), {
      params: Promise.resolve({ id: VEHICLE_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateVehicle).toHaveBeenCalledWith(VEHICLE_ID, { batteryCapacityKwh: 75 });
    expect(body.vehicle.batteryCapacityKwh).toBe(75);
  });

  it("allows clearing the battery capacity with null", async () => {
    updateVehicle.mockResolvedValue({ id: VEHICLE_ID, batteryCapacityKwh: null });
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ batteryCapacityKwh: null }), {
      params: Promise.resolve({ id: VEHICLE_ID }),
    });

    expect(response.status).toBe(200);
    expect(updateVehicle).toHaveBeenCalledWith(VEHICLE_ID, { batteryCapacityKwh: null });
  });

  it("rejects an invalid id", async () => {
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ batteryCapacityKwh: 75 }), {
      params: Promise.resolve({ id: "not-an-id" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a body missing batteryCapacityKwh", async () => {
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ foo: "bar" }), {
      params: Promise.resolve({ id: VEHICLE_ID }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a non-positive battery capacity", async () => {
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ batteryCapacityKwh: 0 }), {
      params: Promise.resolve({ id: VEHICLE_ID }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 when the vehicle does not exist", async () => {
    updateVehicle.mockResolvedValue(null);
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ batteryCapacityKwh: 75 }), {
      params: Promise.resolve({ id: VEHICLE_ID }),
    });

    expect(response.status).toBe(404);
  });
});
