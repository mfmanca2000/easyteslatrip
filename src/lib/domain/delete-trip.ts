import { deleteTrip } from "@/lib/models/trip";
import { deleteDriveSegmentsByTrip } from "@/lib/models/drive-segment";
import { deleteChargeSessionsByTrip } from "@/lib/models/charge-session";
import { deleteRouteLog } from "@/lib/models/route-log";
import { deletePollSnapshotsByTrip } from "@/lib/models/poll-snapshot";
import { deleteTripThumbnail } from "@/lib/models/trip-thumbnail";

// Removes a Trip and everything derived from/for it (DriveSegments,
// ChargeSessions, RouteLog, PollSnapshots, cached thumbnail). Returns false
// when the trip didn't exist, in which case nothing else is touched.
export async function deleteTripCascade(tripId: string): Promise<boolean> {
  await Promise.all([
    deleteDriveSegmentsByTrip(tripId),
    deleteChargeSessionsByTrip(tripId),
    deleteRouteLog(tripId),
    deletePollSnapshotsByTrip(tripId),
    deleteTripThumbnail(tripId),
  ]);
  return deleteTrip(tripId);
}
