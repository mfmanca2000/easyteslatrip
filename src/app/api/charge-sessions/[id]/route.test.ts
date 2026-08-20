import { describe, expect, it, vi } from "vitest";

const updateChargeSession = vi.fn();

vi.mock("@/lib/models/charge-session", () => ({
  updateChargeSession: (...args: unknown[]) => updateChargeSession(...args),
}));

const SESSION_ID = "507f1f77bcf86cd799439099";

function patchRequest(body: unknown) {
  return new Request("http://localhost", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/charge-sessions/[id]", () => {
  it("updates cost as a total euro amount, clearing the per-kWh field and free flag", async () => {
    updateChargeSession.mockResolvedValue({ id: SESSION_ID, costTotal: 12.5, costPerKwh: null, free: false });
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ costTotal: 12.5, costPerKwh: null, free: false }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateChargeSession).toHaveBeenCalledWith(SESSION_ID, {
      costTotal: 12.5,
      costPerKwh: null,
      free: false,
    });
    expect(body.chargeSession.costTotal).toBe(12.5);
  });

  it("marks a session free", async () => {
    updateChargeSession.mockResolvedValue({ id: SESSION_ID, free: true });
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ free: true }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(response.status).toBe(200);
    expect(updateChargeSession).toHaveBeenCalledWith(SESSION_ID, { free: true });
  });

  it("updates the place name", async () => {
    updateChargeSession.mockResolvedValue({ id: SESSION_ID, placeName: "Custom" });
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ placeName: "Custom" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(response.status).toBe(200);
    expect(updateChargeSession).toHaveBeenCalledWith(SESSION_ID, { placeName: "Custom" });
  });

  it("rejects an invalid id", async () => {
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ free: true }), {
      params: Promise.resolve({ id: "not-an-id" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a body with no valid fields", async () => {
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ foo: "bar" }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 when the session does not exist", async () => {
    updateChargeSession.mockResolvedValue(null);
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ free: true }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(response.status).toBe(404);
  });
});
