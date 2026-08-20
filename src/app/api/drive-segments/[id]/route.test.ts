import { describe, expect, it, vi } from "vitest";

const updateDriveSegment = vi.fn();

vi.mock("@/lib/models/drive-segment", () => ({
  updateDriveSegment: (...args: unknown[]) => updateDriveSegment(...args),
}));

const SEGMENT_ID = "507f1f77bcf86cd799439099";

function patchRequest(body: unknown) {
  return new Request("http://localhost", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/drive-segments/[id]", () => {
  it("updates the place name", async () => {
    updateDriveSegment.mockResolvedValue({ id: SEGMENT_ID, startPlaceName: "Custom" });
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ startPlaceName: "Custom" }), {
      params: Promise.resolve({ id: SEGMENT_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateDriveSegment).toHaveBeenCalledWith(SEGMENT_ID, { startPlaceName: "Custom" });
    expect(body.driveSegment.startPlaceName).toBe("Custom");
  });

  it("rejects an invalid id", async () => {
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ startPlaceName: "Custom" }), {
      params: Promise.resolve({ id: "not-an-id" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a body with no valid fields", async () => {
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ foo: "bar" }), {
      params: Promise.resolve({ id: SEGMENT_ID }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 when the segment does not exist", async () => {
    updateDriveSegment.mockResolvedValue(null);
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest({ startPlaceName: "Custom" }), {
      params: Promise.resolve({ id: SEGMENT_ID }),
    });

    expect(response.status).toBe(404);
  });
});
