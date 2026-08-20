import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAnyActiveTrip } from "@/lib/models/trip";
import { getVehicleById } from "@/lib/models/vehicle";
import { createPollSnapshot } from "@/lib/models/poll-snapshot";
import { fetchVehicleSnapshot } from "@/lib/ha";

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
    return new NextResponse(null, { status: 200 });
  }

  const vehicle = await getVehicleById(trip.vehicleId);
  const snapshot = await fetchVehicleSnapshot(vehicle!.entityPrefix);
  await createPollSnapshot({ tripId: trip.id, vehicleId: trip.vehicleId, ...snapshot });

  return new NextResponse(null, { status: 200 });
}

export const GET = handlePollTrigger;
export const HEAD = handlePollTrigger;
