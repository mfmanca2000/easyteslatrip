import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAnyActiveTrip, startTrip, TripAlreadyActiveError } from "@/lib/models/trip";
import { listVehicles } from "@/lib/models/vehicle";
import { fetchVehicleSnapshot } from "@/lib/ha";
import { pollTripOnce } from "@/lib/domain/poll-trip";

// Public (no session gate — see middleware.ts), so the secret check must not
// leak timing information about how many leading characters matched.
function isAuthorized(request: Request, secret: string): boolean {
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authHeader);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Invoked by an external uptime monitor (UptimeRobot, HEAD checks only on
// the free tier) on a ~5-minute interval. Runs the full poll-and-write
// logic server-side regardless of HTTP method — UptimeRobot only reads the
// status code, so the response body stays empty.
async function handlePollTrigger(request: Request): Promise<NextResponse> {
  const secret = process.env.POLL_TRIGGER_SECRET;
  if (!secret || !isAuthorized(request, secret)) {
    return new NextResponse(null, { status: 401 });
  }

  const trip = await getAnyActiveTrip();
  if (!trip) {
    await tryAutoStartTrips();
    return new NextResponse(null, { status: 200 });
  }

  await pollTripOnce(trip.id, trip.vehicleId);

  return new NextResponse(null, { status: 200 });
}

// No trip is active for any vehicle, so check each vehicle's HA state for a
// drive start (shift_state === "D") and auto-start a trip for it — a single
// sample is enough. A stray D-then-back-to-P without moving just leaves an
// idle trip the user closes manually (cheap); missing a real drive start
// silently loses that drive's data entirely (expensive), so the asymmetry
// favors triggering eagerly.
async function tryAutoStartTrips(): Promise<void> {
  const vehicles = await listVehicles();
  for (const vehicle of vehicles) {
    try {
      const snapshot = await fetchVehicleSnapshot(vehicle.entityPrefix);
      if (snapshot.shiftState !== "D") continue;

      const trip = await startTrip(vehicle.id);
      await pollTripOnce(trip.id, vehicle.id);
    } catch (error) {
      if (error instanceof TripAlreadyActiveError) continue; // raced with a concurrent poll
      console.error(`auto-start check failed for vehicle ${vehicle.id}`, error);
    }
  }
}

export const GET = handlePollTrigger;
export const HEAD = handlePollTrigger;
