import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { listTrips, startTrip, TripAlreadyActiveError } from "@/lib/models/trip";

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

  try {
    const trip = await startTrip(vehicleId);
    return NextResponse.json({ trip }, { status: 201 });
  } catch (error) {
    if (error instanceof TripAlreadyActiveError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
