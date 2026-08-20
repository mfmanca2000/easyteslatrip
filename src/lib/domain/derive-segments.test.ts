import { describe, expect, it } from "vitest";
import { deriveSegments, type SnapshotInput } from "./derive-segments";

const BASE_LAT = 44.5;
const BASE_LON = 11.3;

function snapshot(overrides: Partial<SnapshotInput> & { minute: number }): SnapshotInput {
  const { minute, ...rest } = overrides;
  return {
    polledAt: new Date(2026, 7, 20, 7, minute),
    shiftState: "P",
    chargingState: "Disconnected",
    odometer: 15000,
    batteryLevel: 80,
    energyAdded: 0,
    latitude: BASE_LAT,
    longitude: BASE_LON,
    ...rest,
  };
}

describe("deriveSegments — DriveSegment", () => {
  it("absorbs a single lone non-driving sample as noise (does not split the segment)", () => {
    const snapshots: SnapshotInput[] = [
      snapshot({ minute: 0, shiftState: "D", odometer: 15000 }),
      snapshot({ minute: 5, shiftState: "D", odometer: 15003 }),
      snapshot({ minute: 10, shiftState: "P", odometer: 15003 }), // lone noise sample
      snapshot({ minute: 15, shiftState: "D", odometer: 15008 }),
      snapshot({ minute: 20, shiftState: "D", odometer: 15012 }),
    ];

    const { driveSegments } = deriveSegments(snapshots);

    expect(driveSegments).toHaveLength(1);
    expect(driveSegments[0].startOdometer).toBe(15000);
    expect(driveSegments[0].endedAt).toBeNull();
    expect(driveSegments[0].endOdometer).toBeNull();
  });

  it("closes the segment after 2 consecutive non-driving samples", () => {
    const snapshots: SnapshotInput[] = [
      snapshot({ minute: 0, shiftState: "D", odometer: 15000, batteryLevel: 80 }),
      snapshot({ minute: 5, shiftState: "D", odometer: 15005, batteryLevel: 78 }),
      snapshot({ minute: 10, shiftState: "P", odometer: 15005, batteryLevel: 78 }),
      snapshot({ minute: 15, shiftState: "P", odometer: 15005, batteryLevel: 78 }),
      snapshot({ minute: 20, shiftState: "D", odometer: 15020, batteryLevel: 78 }),
    ];

    const { driveSegments } = deriveSegments(snapshots);

    expect(driveSegments).toHaveLength(2);
    expect(driveSegments[0].endedAt).toEqual(new Date(2026, 7, 20, 7, 5));
    expect(driveSegments[0].endOdometer).toBe(15005);
    expect(driveSegments[0].distanceKm).toBe(5);
    expect(driveSegments[0].startBatteryLevel).toBe(80);
    expect(driveSegments[0].endBatteryLevel).toBe(78);
    expect(driveSegments[1].startOdometer).toBe(15020);
    expect(driveSegments[1].endedAt).toBeNull();
    expect(driveSegments[1].endBatteryLevel).toBeNull();
  });
});

describe("deriveSegments — ChargeSession", () => {
  it("closes at charging_state Complete, not at unplug, and stays closed while still plugged in", () => {
    const snapshots: SnapshotInput[] = [
      snapshot({ minute: 0, chargingState: "Charging", batteryLevel: 40, energyAdded: 0 }),
      snapshot({ minute: 30, chargingState: "Charging", batteryLevel: 70, energyAdded: 20 }),
      snapshot({ minute: 60, chargingState: "Complete", batteryLevel: 90, energyAdded: 35 }),
      // still plugged in / Complete for several more polls — must not reopen or split
      snapshot({ minute: 65, chargingState: "Complete", batteryLevel: 90, energyAdded: 35 }),
      snapshot({ minute: 70, chargingState: "Complete", batteryLevel: 90, energyAdded: 35 }),
    ];

    const { chargeSessions } = deriveSegments(snapshots);

    expect(chargeSessions).toHaveLength(1);
    expect(chargeSessions[0].startBatteryLevel).toBe(40);
    expect(chargeSessions[0].endBatteryLevel).toBe(90);
    expect(chargeSessions[0].energyAdded).toBe(35);
    expect(chargeSessions[0].endedAt).toEqual(new Date(2026, 7, 20, 7, 60));
  });

  it("leaves an in-progress charge session open when the stream ends before Complete", () => {
    const snapshots: SnapshotInput[] = [
      snapshot({ minute: 0, chargingState: "Charging", batteryLevel: 40 }),
      snapshot({ minute: 5, chargingState: "Charging", batteryLevel: 45 }),
    ];

    const { chargeSessions } = deriveSegments(snapshots);

    expect(chargeSessions).toHaveLength(1);
    expect(chargeSessions[0].endedAt).toBeNull();
  });
});

describe("deriveSegments — RouteLog", () => {
  it("appends every point in order and does not special-case large time gaps", () => {
    const snapshots: SnapshotInput[] = [
      snapshot({ minute: 0, latitude: 44.0, longitude: 11.0 }),
      // 3-hour gap simulated via a later Date, still just the next point
      snapshot({ minute: 0, latitude: 44.9, longitude: 11.9, polledAt: new Date(2026, 7, 20, 10, 0) }),
      snapshot({ minute: 0, latitude: 45.5, longitude: 12.2, polledAt: new Date(2026, 7, 20, 10, 5) }),
    ];

    const { routeLog } = deriveSegments(snapshots);

    expect(routeLog).toHaveLength(3);
    expect(routeLog.map((p) => [p.latitude, p.longitude])).toEqual([
      [44.0, 11.0],
      [44.9, 11.9],
      [45.5, 12.2],
    ]);
  });
});

describe("deriveSegments — integration", () => {
  it("derives correct segments and route from a realistic mixed sequence", () => {
    const snapshots: SnapshotInput[] = [
      // Drive from home
      snapshot({ minute: 0, shiftState: "D", odometer: 15000, latitude: 44.0, longitude: 11.0 }),
      snapshot({ minute: 5, shiftState: "D", odometer: 15010, latitude: 44.1, longitude: 11.1 }),
      snapshot({ minute: 10, shiftState: "P", odometer: 15010, latitude: 44.15, longitude: 11.15 }), // red light noise
      snapshot({ minute: 15, shiftState: "D", odometer: 15025, latitude: 44.2, longitude: 11.2 }),
      // Two consecutive non-driving samples: arrived, segment closes
      snapshot({ minute: 20, shiftState: "P", odometer: 15025, latitude: 44.25, longitude: 11.25 }),
      snapshot({ minute: 25, shiftState: "P", odometer: 15025, latitude: 44.25, longitude: 11.25 }),
      // Charge session while parked
      snapshot({
        minute: 30,
        shiftState: "P",
        chargingState: "Charging",
        batteryLevel: 50,
        energyAdded: 0,
        odometer: 15025,
        latitude: 44.25,
        longitude: 11.25,
      }),
      snapshot({
        minute: 60,
        shiftState: "P",
        chargingState: "Charging",
        batteryLevel: 80,
        energyAdded: 25,
        odometer: 15025,
        latitude: 44.25,
        longitude: 11.25,
      }),
      snapshot({
        minute: 90,
        shiftState: "P",
        chargingState: "Complete",
        batteryLevel: 95,
        energyAdded: 38,
        odometer: 15025,
        latitude: 44.25,
        longitude: 11.25,
      }),
      // Still plugged in for a while — must not reopen the session
      snapshot({
        minute: 95,
        shiftState: "P",
        chargingState: "Complete",
        batteryLevel: 95,
        energyAdded: 38,
        odometer: 15025,
        latitude: 44.25,
        longitude: 11.25,
      }),
      // Second drive, unplugged
      snapshot({ minute: 100, shiftState: "D", odometer: 15040, latitude: 44.3, longitude: 11.3 }),
      snapshot({ minute: 105, shiftState: "D", odometer: 15055, latitude: 44.35, longitude: 11.35 }),
    ];

    const { driveSegments, chargeSessions, routeLog } = deriveSegments(snapshots);

    expect(driveSegments).toHaveLength(2);
    expect(driveSegments[0].startOdometer).toBe(15000);
    expect(driveSegments[0].endOdometer).toBe(15025);
    expect(driveSegments[0].distanceKm).toBe(25);
    expect(driveSegments[1].startOdometer).toBe(15040);
    expect(driveSegments[1].endedAt).toBeNull(); // trip still ongoing
    expect(driveSegments[1].endOdometer).toBeNull();

    expect(chargeSessions).toHaveLength(1);
    expect(chargeSessions[0].startBatteryLevel).toBe(50);
    expect(chargeSessions[0].endBatteryLevel).toBe(95);
    expect(chargeSessions[0].energyAdded).toBe(38);

    expect(routeLog).toHaveLength(snapshots.length);
  });
});
