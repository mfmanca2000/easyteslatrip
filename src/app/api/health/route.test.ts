import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({
  default: () =>
    Promise.resolve({
      db: () => ({
        command: vi.fn().mockResolvedValue({ ok: 1 }),
      }),
    }),
}));

describe("GET /api/health", () => {
  it("reports ok when mongo responds to ping", async () => {
    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok", mongo: "connected" });
  });
});

describe("GET /api/health when mongo is unreachable", () => {
  it("reports a 503 with the error message", async () => {
    vi.resetModules();
    vi.doMock("@/lib/mongodb", () => ({
      default: () => Promise.reject(new Error("connection refused")),
    }));

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: "error", mongo: "disconnected" });
  });
});
