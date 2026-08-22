import { getVehicleById } from "@/lib/models/vehicle";
import { createPollSnapshot } from "@/lib/models/poll-snapshot";
import { fetchVehicleSnapshot } from "@/lib/ha";
import { syncTripDerivedData } from "@/lib/domain/sync-trip-derived-data";

// Fetches one HA snapshot for a trip's vehicle, writes it to the
// PollSnapshot audit trail, and recomputes derived data from it. Shared by
// the UptimeRobot-triggered poll endpoint (~5-minute cadence) and the
// trip-start flow, which wants one sample immediately rather than waiting
// for the next external trigger.
export async function pollTripOnce(tripId: string, vehicleId: string): Promise<void> {
  const vehicle = await getVehicleById(vehicleId);
  const snapshot = await fetchVehicleSnapshot(vehicle!.entityPrefix);
  await createPollSnapshot({ tripId, vehicleId, ...snapshot });

  // Best-effort: a transient failure here (e.g. Mapbox down) shouldn't fail
  // the poll — the next poll recomputes from full history and retries.
  try {
    await syncTripDerivedData(tripId, vehicleId);
  } catch (error) {
    console.error("syncTripDerivedData failed", error);
  }
}
