import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getVehicleById } from "@/lib/models/vehicle";
import { listTrips } from "@/lib/models/trip";
import { listDriveSegmentsByTripIds } from "@/lib/models/drive-segment";
import { listChargeSessionsByTripIds } from "@/lib/models/charge-session";
import { computeVehicleStats } from "@/lib/domain/vehicle-stats";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid vehicle id" }, { status: 400 });
  }

  const vehicle = await getVehicleById(id);
  if (!vehicle) {
    return NextResponse.json({ error: "vehicle not found" }, { status: 404 });
  }

  const trips = await listTrips(id);
  const completedTripIds = trips.filter((trip) => trip.endedAt !== null).map((trip) => trip.id);

  const [driveSegments, chargeSessions] = await Promise.all([
    listDriveSegmentsByTripIds(completedTripIds),
    listChargeSessionsByTripIds(completedTripIds),
  ]);

  const stats = computeVehicleStats(completedTripIds.length, driveSegments, chargeSessions);

  return NextResponse.json({ vehicle, stats });
}
