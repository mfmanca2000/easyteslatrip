import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getTrip } from "@/lib/models/trip";
import { getVehicleById } from "@/lib/models/vehicle";
import { listDriveSegmentsByTrip } from "@/lib/models/drive-segment";
import { listChargeSessionsByTrip } from "@/lib/models/charge-session";
import { getRouteLog } from "@/lib/models/route-log";
import { listPollSnapshotsByTrip } from "@/lib/models/poll-snapshot";
import { computeTripTotals } from "@/lib/domain/trip-totals";

export async function GET(
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

  const [vehicle, driveSegments, chargeSessions, routeLog, snapshots] = await Promise.all([
    getVehicleById(trip.vehicleId),
    listDriveSegmentsByTrip(id),
    listChargeSessionsByTrip(id),
    getRouteLog(id),
    listPollSnapshotsByTrip(id),
  ]);

  const batterySeries = snapshots.map((snapshot) => ({
    polledAt: snapshot.polledAt,
    batteryLevel: snapshot.batteryLevel,
    odometer: snapshot.odometer,
  }));

  const totals = computeTripTotals(driveSegments, chargeSessions);

  return NextResponse.json({
    trip,
    vehicle,
    driveSegments,
    chargeSessions,
    routeLog,
    batterySeries,
    totals,
  });
}
