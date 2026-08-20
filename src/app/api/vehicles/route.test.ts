import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const listVehicles = vi.fn();
const createVehicle = vi.fn();

vi.mock("@/lib/models/vehicle", () => ({
  listVehicles: (...args: unknown[]) => listVehicles(...args),
  createVehicle: (...args: unknown[]) => createVehicle(...args),
}));

describe("GET /api/vehicles", () => {
  it("returns the list of vehicles", async () => {
    listVehicles.mockResolvedValue([
      { id: "veh1", name: "Electra", entityPrefix: "electra", createdAt: "2026-08-20T00:00:00.000Z" },
    ]);
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.vehicles).toHaveLength(1);
  });
});

describe("POST /api/vehicles", () => {
  it("creates a vehicle", async () => {
    createVehicle.mockResolvedValue({
      id: "veh1",
      name: "Electra",
      entityPrefix: "electra",
      createdAt: "2026-08-20T00:00:00.000Z",
    });
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/vehicles", {
      method: "POST",
      body: JSON.stringify({ name: "Electra", entityPrefix: "electra" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.vehicle.name).toBe("Electra");
  });

  it("rejects a missing name", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/vehicles", {
      method: "POST",
      body: JSON.stringify({ entityPrefix: "electra" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("rejects a malformed request body", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/vehicles", {
      method: "POST",
      body: "not json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("creates a vehicle with a battery capacity", async () => {
    createVehicle.mockResolvedValue({
      id: "veh1",
      name: "Electra",
      entityPrefix: "electra",
      batteryCapacityKwh: 75,
      createdAt: "2026-08-20T00:00:00.000Z",
    });
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/vehicles", {
      method: "POST",
      body: JSON.stringify({ name: "Electra", entityPrefix: "electra", batteryCapacityKwh: 75 }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(createVehicle).toHaveBeenCalledWith({ name: "Electra", entityPrefix: "electra", batteryCapacityKwh: 75 });
    expect(body.vehicle.batteryCapacityKwh).toBe(75);
  });

  it("rejects a non-positive battery capacity", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/vehicles", {
      method: "POST",
      body: JSON.stringify({ name: "Electra", entityPrefix: "electra", batteryCapacityKwh: 0 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
