import { describe, expect, it } from "vitest";
import { buildStaticMapUrl, encodePolyline } from "./route-thumbnail";

describe("encodePolyline", () => {
  it("matches Google's canonical encoding example", () => {
    const points = [
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ];
    expect(encodePolyline(points)).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });
});

describe("buildStaticMapUrl", () => {
  const points = [
    { latitude: 38.5, longitude: -120.2 },
    { latitude: 40.7, longitude: -120.95 },
  ];

  it("returns null with fewer than two points", () => {
    expect(buildStaticMapUrl([points[0]], "pk.test")).toBeNull();
  });

  it("returns null without a token", () => {
    expect(buildStaticMapUrl(points, "")).toBeNull();
  });

  it("builds a dark-style static map URL with the encoded path and token", () => {
    const url = buildStaticMapUrl(points, "pk.test");
    expect(url).toContain("https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/path-3");
    expect(url).toContain("/auto/128x128@2x");
    expect(url).toContain("access_token=pk.test");
  });
});
