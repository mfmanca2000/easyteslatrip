import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { listTrips, startTrip, TripAlreadyActiveError } from "@/lib/models/trip";
import { pollTripOnce } from "@/lib/domain/poll-trip";

export async function GET(request: NextRequest) {
  const vehicleId = request.nextUrl.searchParams.get("vehicleId");

  if (!vehicleId || !ObjectId.isValid(vehicleId)) {
    return NextResponse.json({ error: "vehicleId is required" }, { status: 400 });
  }

  const trips = await listTrips(vehicleId);
  return NextResponse.json({ trips });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const vehicleId = body?.vehicleId;

  if (typeof vehicleId !== "string" || !ObjectId.isValid(vehicleId)) {
    return NextResponse.json({ error: "vehicleId is required" }, { status: 400 });
  }

  let trip;
  try {
    trip = await startTrip(vehicleId);
  } catch (error) {
    if (error instanceof TripAlreadyActiveError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  // Best-effort: get one snapshot on the record immediately instead of
  // waiting for the next ~5-minute UptimeRobot trigger. The trip is already
  // started, so a transient HA failure here shouldn't fail the request —
  // the next external poll will pick it up.
  try {
    await pollTripOnce(trip.id, trip.vehicleId);
  } catch (error) {
    console.error("pollTripOnce failed after starting trip", error);
  }

  return NextResponse.json({ trip }, { status: 201 });
}
