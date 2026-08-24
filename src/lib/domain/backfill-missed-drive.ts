import { createPollSnapshot } from "@/lib/models/poll-snapshot";
import type { MissedDrive } from "@/lib/ha";
import { pollTripOnce } from "@/lib/domain/poll-trip";

// Persists the two historical readings bounding a drive that started and
// ended entirely within a single poll gap (see findMissedDrive in ha.ts),
// then folds in one live poll so the trip also gets the current (real,
// non-D) state — completing the DriveSegment's grace-period countdown from
// the correct backfilled timestamp instead of only from whenever this
// function happened to run.
export async function backfillMissedDrive(
  tripId: string,
  vehicleId: string,
  missedDrive: MissedDrive,
): Promise<void> {
  await createPollSnapshot({ tripId, vehicleId, polledAt: missedDrive.start.at, ...missedDrive.start.snapshot });
  await createPollSnapshot({ tripId, vehicleId, polledAt: missedDrive.end.at, ...missedDrive.end.snapshot });
  await pollTripOnce(tripId, vehicleId);
}
