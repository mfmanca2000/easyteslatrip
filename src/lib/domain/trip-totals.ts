// Pure aggregation of a Trip's totals from its DriveSegments and
// ChargeSessions, for the Trip Detail page's stat cards.

export interface TripTotalsDriveSegmentInput {
  startedAt: string;
  endedAt: string | null;
  distanceKm: number | null;
}

export interface TripTotalsChargeSessionInput {
  startedAt: string;
  endedAt: string | null;
  energyAdded: number | null;
  costPerKwh: number | null;
  costTotal: number | null;
  free: boolean;
}

export interface TripTotals {
  distanceKm: number;
  drivingMinutes: number;
  chargingMinutes: number;
  energyAddedKwh: number;
  totalCost: number;
  allChargesFree: boolean;
}

function minutesBetween(startedAt: string, endedAt: string | null): number {
  if (!endedAt) return 0;
  return (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000;
}

function chargeCost(session: TripTotalsChargeSessionInput): number {
  if (session.free) return 0;
  if (session.costTotal != null) return session.costTotal;
  if (session.costPerKwh != null && session.energyAdded != null) {
    return session.costPerKwh * session.energyAdded;
  }
  return 0;
}

export function computeTripTotals(
  driveSegments: TripTotalsDriveSegmentInput[],
  chargeSessions: TripTotalsChargeSessionInput[],
): TripTotals {
  const distanceKm = driveSegments.reduce((sum, s) => sum + (s.distanceKm ?? 0), 0);
  const drivingMinutes = driveSegments.reduce((sum, s) => sum + minutesBetween(s.startedAt, s.endedAt), 0);
  const chargingMinutes = chargeSessions.reduce((sum, s) => sum + minutesBetween(s.startedAt, s.endedAt), 0);
  const energyAddedKwh = chargeSessions.reduce((sum, s) => sum + (s.energyAdded ?? 0), 0);
  const totalCost = chargeSessions.reduce((sum, s) => sum + chargeCost(s), 0);
  const allChargesFree = chargeSessions.length > 0 && chargeSessions.every((s) => s.free);

  return { distanceKm, drivingMinutes, chargingMinutes, energyAddedKwh, totalCost, allChargesFree };
}
