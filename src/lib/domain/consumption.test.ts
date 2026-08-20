import { describe, expect, it } from "vitest";
import { aggregateWhPerKm, segmentEnergyUsedKwh, segmentWhPerKm } from "./consumption";

describe("segmentEnergyUsedKwh", () => {
  it("computes energy used from the battery % drop times pack capacity", () => {
    const energy = segmentEnergyUsedKwh({ distanceKm: 100, startBatteryLevel: 80, endBatteryLevel: 60 }, 75);
    expect(energy).toBe(15);
  });

  it("returns null when the segment is still open", () => {
    const energy = segmentEnergyUsedKwh({ distanceKm: null, startBatteryLevel: 80, endBatteryLevel: null }, 75);
    expect(energy).toBeNull();
  });

  it("returns null when the vehicle has no configured battery capacity", () => {
    const energy = segmentEnergyUsedKwh({ distanceKm: 100, startBatteryLevel: 80, endBatteryLevel: 60 }, null);
    expect(energy).toBeNull();
  });
});

describe("segmentWhPerKm", () => {
  it("converts energy used to Wh/km over the segment's distance", () => {
    const whPerKm = segmentWhPerKm({ distanceKm: 100, startBatteryLevel: 80, endBatteryLevel: 60 }, 75);
    expect(whPerKm).toBe(150);
  });

  it("returns null for a zero-distance segment", () => {
    const whPerKm = segmentWhPerKm({ distanceKm: 0, startBatteryLevel: 80, endBatteryLevel: 79 }, 75);
    expect(whPerKm).toBeNull();
  });
});

describe("aggregateWhPerKm", () => {
  it("sums energy used and distance across segments rather than averaging per-leg ratios", () => {
    const whPerKm = aggregateWhPerKm(
      [
        { distanceKm: 100, startBatteryLevel: 80, endBatteryLevel: 70 },
        { distanceKm: 50, startBatteryLevel: 70, endBatteryLevel: 65 },
      ],
      75,
    );
    // 10% + 5% of 75 kWh = 11.25 kWh over 150 km
    expect(whPerKm).toBeCloseTo(75, 5);
  });

  it("skips open segments but still counts closed ones", () => {
    const whPerKm = aggregateWhPerKm(
      [
        { distanceKm: 100, startBatteryLevel: 80, endBatteryLevel: 70 },
        { distanceKm: null, startBatteryLevel: 70, endBatteryLevel: null },
      ],
      75,
    );
    expect(whPerKm).toBe(75);
  });

  it("returns null when there is no closed distance to divide by", () => {
    const whPerKm = aggregateWhPerKm([{ distanceKm: null, startBatteryLevel: 80, endBatteryLevel: null }], 75);
    expect(whPerKm).toBeNull();
  });

  it("returns null when the vehicle has no configured battery capacity", () => {
    const whPerKm = aggregateWhPerKm([{ distanceKm: 100, startBatteryLevel: 80, endBatteryLevel: 70 }], null);
    expect(whPerKm).toBeNull();
  });
});
