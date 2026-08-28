import { getVehicleById } from "@/lib/models/vehicle";
import { createPollSnapshot } from "@/lib/models/poll-snapshot";
import { fetchVehicleSnapshot } from "@/lib/ha";
import { syncTripDerivedData } from "@/lib/domain/sync-trip-derived-data";
import { listDriveSegmentsByTrip } from "@/lib/models/drive-segment";
import { stopTrip } from "@/lib/models/trip";

// Once the trip's last DriveSegment has closed (see
// DRIVE_SEGMENT_CLOSE_GRACE_MS in derive-segments.ts) and the vehicle has
// stayed parked this much longer on top of that, the trip auto-stops. The
// extra window (on top of the leg's own close grace) gives the user a
// chance to keep the trip open — e.g. a quick errand — before it closes on
// its own.
const AUTO_STOP_GRACE_MS = 20 * 60 * 1000;

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

  // A charging stop (e.g. a supercharger mid-trip) can sit in P well past
  // AUTO_STOP_GRACE_MS without the trip being over, so skip the auto-stop
  // check entirely while actively charging.
  if (snapshot.shiftState === "P" && !snapshot.charging) {
    await maybeAutoStopTrip(tripId, vehicleId);
  }
}

// Sustained-P auto-stop: only once every DriveSegment on the trip is closed
// (none still open/driving) and the last one closed at least
// AUTO_STOP_GRACE_MS ago. A trip with no closed leg yet (e.g. the very
// first poll right after auto-start) is left alone.
async function maybeAutoStopTrip(tripId: string, vehicleId: string): Promise<void> {
  const segments = await listDriveSegmentsByTrip(tripId);
  if (segments.length === 0 || segments.some((segment) => !segment.endedAt)) return;

  const lastClosedAt = Math.max(
    ...segments.map((segment) => new Date(segment.endedAt!).getTime()),
  );
  if (Date.now() - lastClosedAt < AUTO_STOP_GRACE_MS) return;

  const trip = await stopTrip(tripId);
  if (!trip) return; // already stopped concurrently (e.g. a racing manual stop)

  try {
    await syncTripDerivedData(tripId, vehicleId, { tripEnded: true });
  } catch (error) {
    console.error("syncTripDerivedData failed after auto-stop", error);
  }
}
