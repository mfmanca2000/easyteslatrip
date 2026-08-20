import { deleteTrip } from "@/lib/models/trip";
import { deleteDriveSegmentsByTrip } from "@/lib/models/drive-segment";
import { deleteChargeSessionsByTrip } from "@/lib/models/charge-session";
import { deleteRouteLog } from "@/lib/models/route-log";
import { deletePollSnapshotsByTrip } from "@/lib/models/poll-snapshot";

// Removes a Trip and everything derived from/for it (DriveSegments,
// ChargeSessions, RouteLog, PollSnapshots). Returns false when the trip
// didn't exist, in which case nothing else is touched.
export async function deleteTripCascade(tripId: string): Promise<boolean> {
  await Promise.all([
    deleteDriveSegmentsByTrip(tripId),
    deleteChargeSessionsByTrip(tripId),
    deleteRouteLog(tripId),
    deletePollSnapshotsByTrip(tripId),
  ]);
  return deleteTrip(tripId);
}
