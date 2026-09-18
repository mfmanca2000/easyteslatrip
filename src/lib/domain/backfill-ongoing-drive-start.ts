import { createPollSnapshot } from "@/lib/models/poll-snapshot";
import type { OngoingDriveStart } from "@/lib/ha";
import { pollTripOnce } from "@/lib/domain/poll-trip";

// Persists the historical reading for when a still-ongoing drive actually
// started (see findOngoingDriveStart in ha.ts), then folds in one live poll
// so the trip also gets the vehicle's current state — the same two-step
// pattern backfillMissedDrive uses for a drive that's already over, just
// with one bounding reading instead of two since this one hasn't closed.
export async function backfillOngoingDriveStart(
  tripId: string,
  vehicleId: string,
  start: OngoingDriveStart,
): Promise<void> {
  await createPollSnapshot({ tripId, vehicleId, polledAt: start.at, ...start.snapshot });
  await pollTripOnce(tripId, vehicleId);
}
