import { describe, expect, it } from "vitest";
import { computeTripTotals } from "./trip-totals";

describe("computeTripTotals", () => {
  it("sums distance and driving time across drive segments", () => {
    const totals = computeTripTotals(
      [
        { startedAt: "2026-08-20T07:00:00.000Z", endedAt: "2026-08-20T08:00:00.000Z", distanceKm: 100 },
        { startedAt: "2026-08-20T09:00:00.000Z", endedAt: "2026-08-20T09:30:00.000Z", distanceKm: 40 },
      ],
      [],
    );

    expect(totals.distanceKm).toBe(140);
    expect(totals.drivingMinutes).toBe(90);
  });

  it("ignores an open (still-driving) segment's duration", () => {
    const totals = computeTripTotals(
      [{ startedAt: "2026-08-20T07:00:00.000Z", endedAt: null, distanceKm: null }],
      [],
    );

    expect(totals.distanceKm).toBe(0);
    expect(totals.drivingMinutes).toBe(0);
  });

  it("sums charging time and energy added across charge sessions", () => {
    const totals = computeTripTotals(
      [],
      [
        {
          startedAt: "2026-08-20T07:00:00.000Z",
          endedAt: "2026-08-20T07:28:00.000Z",
          energyAdded: 42,
          costPerKwh: null,
          costTotal: null,
          free: true,
        },
      ],
    );

    expect(totals.chargingMinutes).toBe(28);
    expect(totals.energyAddedKwh).toBe(42);
  });

  it("marks allChargesFree only when every session is free", () => {
    const allFree = computeTripTotals(
      [],
      [
        { startedAt: "s", endedAt: "e", energyAdded: 10, costPerKwh: null, costTotal: null, free: true },
        { startedAt: "s", endedAt: "e", energyAdded: 10, costPerKwh: null, costTotal: null, free: true },
      ],
    );
    expect(allFree.allChargesFree).toBe(true);

    const mixed = computeTripTotals(
      [],
      [
        { startedAt: "s", endedAt: "e", energyAdded: 10, costPerKwh: null, costTotal: null, free: true },
        { startedAt: "s", endedAt: "e", energyAdded: 10, costPerKwh: 0.5, costTotal: null, free: false },
      ],
    );
    expect(mixed.allChargesFree).toBe(false);
  });

  it("computes cost from a total-euro entry", () => {
    const totals = computeTripTotals(
      [],
      [{ startedAt: "s", endedAt: "e", energyAdded: 20, costPerKwh: null, costTotal: 12.5, free: false }],
    );
    expect(totals.totalCost).toBe(12.5);
  });

  it("computes cost from a per-kWh entry times energy added", () => {
    const totals = computeTripTotals(
      [],
      [{ startedAt: "s", endedAt: "e", energyAdded: 20, costPerKwh: 0.4, costTotal: null, free: false }],
    );
    expect(totals.totalCost).toBe(8);
  });

  it("treats a session with no cost info entered as contributing zero cost", () => {
    const totals = computeTripTotals(
      [],
      [{ startedAt: "s", endedAt: "e", energyAdded: 20, costPerKwh: null, costTotal: null, free: false }],
    );
    expect(totals.totalCost).toBe(0);
    expect(totals.allChargesFree).toBe(false);
  });
});
