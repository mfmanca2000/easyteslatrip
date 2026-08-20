import { afterEach, describe, expect, it, vi } from "vitest";

describe("reverseGeocode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("resolves the first feature's place name", async () => {
    vi.stubEnv("MAPBOX_TOKEN", "test-token");
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("11.3,44.5.json");
      expect(url).toContain("access_token=test-token");
      return {
        ok: true,
        json: async () => ({ features: [{ place_name: "Bologna, Italy" }] }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { reverseGeocode } = await import("./geocode");
    const placeName = await reverseGeocode(44.5, 11.3);

    expect(placeName).toBe("Bologna, Italy");
  });

  it("returns null when no feature is found", async () => {
    vi.stubEnv("MAPBOX_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ features: [] }) })));

    const { reverseGeocode } = await import("./geocode");

    expect(await reverseGeocode(0, 0)).toBeNull();
  });

  it("throws when the Mapbox token is missing", async () => {
    vi.stubEnv("MAPBOX_TOKEN", "");

    const { reverseGeocode } = await import("./geocode");

    await expect(reverseGeocode(44.5, 11.3)).rejects.toThrow(/Missing required env var/);
  });

  it("throws when Mapbox responds with a non-ok status", async () => {
    vi.stubEnv("MAPBOX_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));

    const { reverseGeocode } = await import("./geocode");

    await expect(reverseGeocode(44.5, 11.3)).rejects.toThrow(/Mapbox geocoding request failed/);
  });
});
