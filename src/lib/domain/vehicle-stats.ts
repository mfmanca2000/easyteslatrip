// Aggregation of a Vehicle's all-time totals across every completed Trip's
// DriveSegments and ChargeSessions, for the All-time Stats page.

import {
  computeTripTotals,
  type TripTotals,
  type TripTotalsChargeSessionInput,
  type TripTotalsDriveSegmentInput,
} from "./trip-totals";

export interface VehicleStats extends TripTotals {
  tripCount: number;
  avgSpeedKmh: number;
}

export function computeVehicleStats(
  tripCount: number,
  driveSegments: TripTotalsDriveSegmentInput[],
  chargeSessions: TripTotalsChargeSessionInput[],
): VehicleStats {
  const totals = computeTripTotals(driveSegments, chargeSessions);
  const avgSpeedKmh = totals.drivingMinutes > 0 ? totals.distanceKm / (totals.drivingMinutes / 60) : 0;

  return { ...totals, tripCount, avgSpeedKmh };
}
