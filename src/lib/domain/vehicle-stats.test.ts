import { describe, expect, it } from "vitest";
import { computeVehicleStats } from "./vehicle-stats";

describe("computeVehicleStats", () => {
  it("aggregates distance, driving time, charging time, energy, and cost across trips", () => {
    const stats = computeVehicleStats(
      2,
      [
        { startedAt: "2026-08-20T07:00:00.000Z", endedAt: "2026-08-20T08:00:00.000Z", distanceKm: 100 },
        { startedAt: "2026-08-21T07:00:00.000Z", endedAt: "2026-08-21T07:30:00.000Z", distanceKm: 40 },
      ],
      [
        {
          startedAt: "2026-08-20T08:00:00.000Z",
          endedAt: "2026-08-20T08:28:00.000Z",
          energyAdded: 42,
          costPerKwh: null,
          costTotal: 12,
          free: false,
        },
      ],
    );

    expect(stats.tripCount).toBe(2);
    expect(stats.distanceKm).toBe(140);
    expect(stats.drivingMinutes).toBe(90);
    expect(stats.chargingMinutes).toBe(28);
    expect(stats.energyAddedKwh).toBe(42);
    expect(stats.totalCost).toBe(12);
  });

  it("computes average driving speed from total distance over total driving time", () => {
    const stats = computeVehicleStats(
      1,
      [{ startedAt: "2026-08-20T07:00:00.000Z", endedAt: "2026-08-20T09:00:00.000Z", distanceKm: 150 }],
      [],
    );

    expect(stats.avgSpeedKmh).toBe(75);
  });

  it("reports zero average speed when there is no driving time yet", () => {
    const stats = computeVehicleStats(0, [], []);

    expect(stats.avgSpeedKmh).toBe(0);
  });
});
