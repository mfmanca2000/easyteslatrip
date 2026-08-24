import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getTrip = vi.fn();
const getRouteLog = vi.fn();
const getTripThumbnail = vi.fn();
const saveTripThumbnail = vi.fn();

vi.mock("@/lib/models/trip", () => ({
  getTrip: (...args: unknown[]) => getTrip(...args),
}));
vi.mock("@/lib/models/route-log", () => ({
  getRouteLog: (...args: unknown[]) => getRouteLog(...args),
}));
vi.mock("@/lib/models/trip-thumbnail", () => ({
  getTripThumbnail: (...args: unknown[]) => getTripThumbnail(...args),
  saveTripThumbnail: (...args: unknown[]) => saveTripThumbnail(...args),
}));

const TRIP_ID = "507f1f77bcf86cd799439099";
const ROUTE = [
  { latitude: 45.0, longitude: 9.0 },
  { latitude: 45.1, longitude: 9.1 },
];

describe("GET /api/trips/[id]/thumbnail", () => {
  const originalToken = process.env.MAPBOX_TOKEN;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.MAPBOX_TOKEN = "pk.test";
    getTrip.mockReset();
    getRouteLog.mockReset().mockResolvedValue(ROUTE);
    getTripThumbnail.mockReset();
    saveTripThumbnail.mockReset().mockResolvedValue(undefined);
    fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    process.env.MAPBOX_TOKEN = originalToken;
    vi.unstubAllGlobals();
  });

  it("returns 400 for an invalid trip id", async () => {
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "not-an-id" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 when the trip does not exist", async () => {
    getTrip.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: TRIP_ID }),
    });

    expect(response.status).toBe(404);
  });

  it("serves the cached thumbnail for a completed trip without contacting Mapbox", async () => {
    getTrip.mockResolvedValue({ id: TRIP_ID, endedAt: "2026-01-01T00:00:00.000Z" });
    getTripThumbnail.mockResolvedValue({
      data: Buffer.from([9, 9, 9]),
      contentType: "image/png",
    });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: TRIP_ID }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("immutable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("generates and caches the thumbnail on first request for a completed trip", async () => {
    getTrip.mockResolvedValue({ id: TRIP_ID, endedAt: "2026-01-01T00:00:00.000Z" });
    getTripThumbnail.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: TRIP_ID }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(saveTripThumbnail).toHaveBeenCalledWith(TRIP_ID, expect.any(Buffer), "image/png");
    expect(response.headers.get("Cache-Control")).toContain("immutable");
  });

  it("renders an in-progress trip live without caching", async () => {
    getTrip.mockResolvedValue({ id: TRIP_ID, endedAt: null });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: TRIP_ID }),
    });

    expect(response.status).toBe(200);
    expect(getTripThumbnail).not.toHaveBeenCalled();
    expect(saveTripThumbnail).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 404 when there is no route to render", async () => {
    getTrip.mockResolvedValue({ id: TRIP_ID, endedAt: "2026-01-01T00:00:00.000Z" });
    getTripThumbnail.mockResolvedValue(null);
    getRouteLog.mockResolvedValue([]);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: TRIP_ID }),
    });

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 502 when the upstream Mapbox request fails", async () => {
    getTrip.mockResolvedValue({ id: TRIP_ID, endedAt: "2026-01-01T00:00:00.000Z" });
    getTripThumbnail.mockResolvedValue(null);
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: TRIP_ID }),
    });

    expect(response.status).toBe(502);
    expect(saveTripThumbnail).not.toHaveBeenCalled();
  });
});
