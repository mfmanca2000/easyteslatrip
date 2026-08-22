import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getTrip } from "@/lib/models/trip";
import { pollTripOnce } from "@/lib/domain/poll-trip";

// Session-gated (see middleware.ts) trigger the trip detail page hits on a
// ~1-minute interval while it's open, so the live view gets fresh HA data
// instead of waiting on UptimeRobot's ~5-minute external trigger.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid trip id" }, { status: 400 });
  }

  const trip = await getTrip(id);
  if (!trip) {
    return NextResponse.json({ error: "trip not found" }, { status: 404 });
  }

  if (trip.endedAt === null) {
    await pollTripOnce(trip.id, trip.vehicleId);
  }

  return new NextResponse(null, { status: 204 });
}
