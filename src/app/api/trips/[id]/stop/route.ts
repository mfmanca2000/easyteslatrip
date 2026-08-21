import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { stopTrip } from "@/lib/models/trip";
import { syncTripDerivedData } from "@/lib/domain/sync-trip-derived-data";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid trip id" }, { status: 400 });
  }

  const trip = await stopTrip(id);

  if (!trip) {
    return NextResponse.json(
      { error: "trip not found or already stopped" },
      { status: 404 },
    );
  }

  // Closes any still-open trailing DriveSegment/ChargeSession now that no
  // more polls will arrive for this trip. Best-effort like the poll route's
  // call — a transient failure here (e.g. Mapbox down) shouldn't stop the
  // trip from being marked stopped.
  try {
    await syncTripDerivedData(trip.id, trip.vehicleId, { tripEnded: true });
  } catch (error) {
    console.error("syncTripDerivedData failed", error);
  }

  return NextResponse.json({ trip });
}
