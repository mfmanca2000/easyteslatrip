// Pure Wh/km consumption calculations. HA exposes battery level (%) but no
// energy-consumed sensor, so consumption is inferred from the battery %
// drop over a DriveSegment times the vehicle's battery pack capacity
// (a user-entered Vehicle field — see CONTEXT.md).

export interface ConsumptionSegmentInput {
  distanceKm: number | null;
  startBatteryLevel: number;
  endBatteryLevel: number | null;
}

export function segmentEnergyUsedKwh(
  segment: ConsumptionSegmentInput,
  batteryCapacityKwh: number | null,
): number | null {
  if (batteryCapacityKwh == null || segment.endBatteryLevel == null) return null;
  return ((segment.startBatteryLevel - segment.endBatteryLevel) / 100) * batteryCapacityKwh;
}

export function segmentWhPerKm(
  segment: ConsumptionSegmentInput,
  batteryCapacityKwh: number | null,
): number | null {
  const energyUsedKwh = segmentEnergyUsedKwh(segment, batteryCapacityKwh);
  if (energyUsedKwh == null || segment.distanceKm == null || segment.distanceKm <= 0) return null;
  return (energyUsedKwh * 1000) / segment.distanceKm;
}

// Aggregates Wh/km across many segments (a trip, or every trip for a
// vehicle) as total energy used over total distance — not an average of
// per-leg ratios, so longer legs weigh proportionally more.
export function aggregateWhPerKm(
  segments: ConsumptionSegmentInput[],
  batteryCapacityKwh: number | null,
): number | null {
  let totalEnergyKwh = 0;
  let totalDistanceKm = 0;
  for (const segment of segments) {
    const energyUsedKwh = segmentEnergyUsedKwh(segment, batteryCapacityKwh);
    if (energyUsedKwh == null || segment.distanceKm == null || segment.distanceKm <= 0) continue;
    totalEnergyKwh += energyUsedKwh;
    totalDistanceKm += segment.distanceKm;
  }
  return totalDistanceKm > 0 ? (totalEnergyKwh * 1000) / totalDistanceKm : null;
}
