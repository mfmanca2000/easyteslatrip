import { listPollSnapshotsByTrip } from "@/lib/models/poll-snapshot";
import {
  listDriveSegmentsByTrip,
  saveDriveSegments,
  type DriveSegmentToSave,
} from "@/lib/models/drive-segment";
import {
  listChargeSessionsByTrip,
  saveChargeSessions,
  type ChargeSessionToSave,
} from "@/lib/models/charge-session";
import { replaceRouteLog } from "@/lib/models/route-log";
import { reverseGeocode } from "@/lib/geocode";
import { deriveSegments, type DerivedDriveSegment, type DerivedChargeSession } from "@/lib/domain/derive-segments";
import type { DriveSegment } from "@/lib/models/drive-segment";
import type { ChargeSession } from "@/lib/models/charge-session";

// Recomputes DriveSegments, ChargeSessions, and the RouteLog for a trip from
// its full PollSnapshot history, geocoding only segments/sessions that just
// closed in this recomputation (matched to the previous set by startedAt —
// a segment/session's start time is stable across recomputes). Segments
// already closed and geocoded on a prior call keep their stored place name
// instead of re-fetching it.
export async function syncTripDerivedData(tripId: string, vehicleId: string): Promise<void> {
  const snapshots = await listPollSnapshotsByTrip(tripId);
  const { driveSegments, chargeSessions, routeLog } = deriveSegments(
    snapshots.map((snapshot) => ({
      polledAt: new Date(snapshot.polledAt),
      shiftState: snapshot.shiftState,
      chargingState: snapshot.chargingState,
      odometer: snapshot.odometer,
      batteryLevel: snapshot.batteryLevel,
      energyAdded: snapshot.energyAdded,
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
    })),
  );

  const previousDrive = await listDriveSegmentsByTrip(tripId);
  const mergedDrive = await Promise.all(
    driveSegments.map((segment) => mergeDriveSegment(segment, previousDrive)),
  );
  await saveDriveSegments(tripId, vehicleId, mergedDrive);

  const previousCharge = await listChargeSessionsByTrip(tripId);
  const mergedCharge = await Promise.all(
    chargeSessions.map((session) => mergeChargeSession(session, previousCharge)),
  );
  await saveChargeSessions(tripId, vehicleId, mergedCharge);

  await replaceRouteLog(tripId, routeLog);
}

async function mergeDriveSegment(
  segment: DerivedDriveSegment,
  previous: DriveSegment[],
): Promise<DriveSegmentToSave> {
  const match = previous.find((p) => new Date(p.startedAt).getTime() === segment.startedAt.getTime());

  if (!segment.endedAt) {
    return { ...segment, startPlaceName: null, endPlaceName: null };
  }
  // A previous run already closed and saved this segment, so it already
  // went through geocoding once — reuse its result even if that result was
  // null (Mapbox legitimately found nothing there), rather than retrying
  // forever. A match with no endedAt means the prior save never completed
  // (e.g. a geocode failure aborted that sync before saving), so it's
  // correctly treated as not-yet-attempted.
  if (match?.endedAt) {
    return { ...segment, startPlaceName: match.startPlaceName, endPlaceName: match.endPlaceName };
  }

  const [startPlaceName, endPlaceName] = await Promise.all([
    reverseGeocode(segment.startLatitude, segment.startLongitude),
    reverseGeocode(segment.endLatitude!, segment.endLongitude!),
  ]);
  return { ...segment, startPlaceName, endPlaceName };
}

function carriedCostFields(match: ChargeSession | undefined) {
  return {
    costPerKwh: match?.costPerKwh ?? null,
    costTotal: match?.costTotal ?? null,
    free: match?.free ?? false,
  };
}

async function mergeChargeSession(
  session: DerivedChargeSession,
  previous: ChargeSession[],
): Promise<ChargeSessionToSave> {
  const match = previous.find((p) => new Date(p.startedAt).getTime() === session.startedAt.getTime());
  const cost = carriedCostFields(match);

  if (!session.endedAt) {
    return { ...session, placeName: null, ...cost };
  }
  // See the analogous comment in mergeDriveSegment: reuse a prior legitimate
  // null result instead of re-geocoding forever.
  if (match?.endedAt) {
    return { ...session, placeName: match.placeName, ...cost };
  }

  const placeName = await reverseGeocode(session.latitude, session.longitude);
  return { ...session, placeName, ...cost };
}
