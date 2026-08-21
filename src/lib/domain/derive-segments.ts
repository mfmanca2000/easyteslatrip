// Pure domain algorithm: derive DriveSegments, ChargeSessions, and a
// RouteLog from an ordered stream of PollSnapshots. No HA/Mongo/HTTP here —
// see CONTEXT.md's "Segment inference rules" for the source of these rules.

export interface SnapshotInput {
  polledAt: Date;
  shiftState: string;
  chargingState: string;
  odometer: number;
  batteryLevel: number;
  energyAdded: number;
  latitude: number;
  longitude: number;
}

export interface DerivedDriveSegment {
  startedAt: Date;
  endedAt: Date | null;
  startOdometer: number;
  endOdometer: number | null;
  distanceKm: number | null;
  startBatteryLevel: number;
  endBatteryLevel: number | null;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number | null;
  endLongitude: number | null;
}

export interface DerivedChargeSession {
  startedAt: Date;
  endedAt: Date | null;
  startBatteryLevel: number;
  endBatteryLevel: number | null;
  energyAdded: number | null;
  latitude: number;
  longitude: number;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  recordedAt: Date;
}

export interface DerivedResult {
  driveSegments: DerivedDriveSegment[];
  chargeSessions: DerivedChargeSession[];
  routeLog: RoutePoint[];
}

function buildDriveSegment(
  start: SnapshotInput,
  end: SnapshotInput | null,
): DerivedDriveSegment {
  return {
    startedAt: start.polledAt,
    endedAt: end ? end.polledAt : null,
    startOdometer: start.odometer,
    endOdometer: end ? end.odometer : null,
    distanceKm: end ? end.odometer - start.odometer : null,
    startBatteryLevel: start.batteryLevel,
    endBatteryLevel: end ? end.batteryLevel : null,
    startLatitude: start.latitude,
    startLongitude: start.longitude,
    endLatitude: end ? end.latitude : null,
    endLongitude: end ? end.longitude : null,
  };
}

export interface DeriveSegmentsOptions {
  // Set once the owning Trip has been manually stopped: there will be no
  // further PollSnapshots, so a still-open DriveSegment/ChargeSession would
  // otherwise stay open forever (never geocoded, never counted in Trip
  // totals). Closes each using the last sample seen for it instead of
  // leaving it open — the best data that will ever exist for it.
  closeTrailing?: boolean;
}

export function deriveSegments(
  snapshots: SnapshotInput[],
  options: DeriveSegmentsOptions = {},
): DerivedResult {
  const driveSegments: DerivedDriveSegment[] = [];
  const chargeSessions: DerivedChargeSession[] = [];
  const routeLog: RoutePoint[] = [];

  let driveStart: SnapshotInput | null = null;
  let lastDriveSample: SnapshotInput | null = null;
  // Non-driving samples seen since the drive was last extended. A single one
  // is treated as noise (e.g. a red light) and gets absorbed once driving
  // resumes; a second consecutive one closes the segment.
  let pendingNonDrive: SnapshotInput[] = [];

  let openCharge: DerivedChargeSession | null = null;
  let lastChargeSample: SnapshotInput | null = null;

  for (const snapshot of snapshots) {
    routeLog.push({
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      recordedAt: snapshot.polledAt,
    });

    // --- DriveSegment state machine ---
    if (snapshot.shiftState === "D") {
      if (!driveStart) driveStart = snapshot;
      lastDriveSample = snapshot;
      pendingNonDrive = [];
    } else if (driveStart) {
      pendingNonDrive.push(snapshot);
      if (pendingNonDrive.length >= 2) {
        driveSegments.push(buildDriveSegment(driveStart, lastDriveSample));
        driveStart = null;
        lastDriveSample = null;
        pendingNonDrive = [];
      }
    }

    // --- ChargeSession state machine ---
    if (snapshot.chargingState === "Charging") {
      if (!openCharge) {
        openCharge = {
          startedAt: snapshot.polledAt,
          endedAt: null,
          startBatteryLevel: snapshot.batteryLevel,
          endBatteryLevel: null,
          energyAdded: null,
          latitude: snapshot.latitude,
          longitude: snapshot.longitude,
        };
      }
      lastChargeSample = snapshot;
    } else if (openCharge && snapshot.chargingState === "Complete") {
      chargeSessions.push({
        ...openCharge,
        endedAt: snapshot.polledAt,
        endBatteryLevel: snapshot.batteryLevel,
        energyAdded: snapshot.energyAdded,
      });
      openCharge = null;
      lastChargeSample = null;
    }
  }

  if (driveStart) {
    driveSegments.push(
      buildDriveSegment(driveStart, options.closeTrailing ? lastDriveSample : null),
    );
  }
  if (openCharge) {
    chargeSessions.push(
      options.closeTrailing && lastChargeSample
        ? {
            ...openCharge,
            endedAt: lastChargeSample.polledAt,
            endBatteryLevel: lastChargeSample.batteryLevel,
            energyAdded: lastChargeSample.energyAdded,
          }
        : openCharge,
    );
  }

  return { driveSegments, chargeSessions, routeLog };
}
