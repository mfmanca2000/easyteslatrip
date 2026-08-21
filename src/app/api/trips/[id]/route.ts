import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getTrip } from "@/lib/models/trip";
import { getVehicleById } from "@/lib/models/vehicle";
import { listDriveSegmentsByTrip } from "@/lib/models/drive-segment";
import { listChargeSessionsByTrip } from "@/lib/models/charge-session";
import { getRouteLog } from "@/lib/models/route-log";
import { listPollSnapshotsByTrip } from "@/lib/models/poll-snapshot";
import { computeTripTotals } from "@/lib/domain/trip-totals";
import { segmentWhPerKm } from "@/lib/domain/consumption";
import { deleteTripCascade } from "@/lib/domain/delete-trip";
import { syncTripDerivedData } from "@/lib/domain/sync-trip-derived-data";

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

  const [vehicle, driveSegmentsResult, chargeSessionsResult, routeLog, snapshots] = await Promise.all([
    getVehicleById(trip.vehicleId),
    listDriveSegmentsByTrip(id),
    listChargeSessionsByTrip(id),
    getRouteLog(id),
    listPollSnapshotsByTrip(id),
  ]);

  let driveSegments = driveSegmentsResult;
  let chargeSessions = chargeSessionsResult;

  // Self-heal trips stopped before this closing behavior existed (or by a
  // client that raced the fix): a trailing DriveSegment/ChargeSession left
  // open on an already-ended trip will never get new polls to close it, so
  // close it here the same way the stop endpoint now does.
  const hasOpenTrailingData =
    trip.endedAt != null &&
    (driveSegments.some((segment) => segment.endedAt === null) ||
      chargeSessions.some((session) => session.endedAt === null));
  if (hasOpenTrailingData) {
    try {
      await syncTripDerivedData(trip.id, trip.vehicleId, { tripEnded: true });
      [driveSegments, chargeSessions] = await Promise.all([
        listDriveSegmentsByTrip(id),
        listChargeSessionsByTrip(id),
      ]);
    } catch (error) {
      console.error("syncTripDerivedData failed", error);
    }
  }

  const batterySeries = snapshots.map((snapshot) => ({
    polledAt: snapshot.polledAt,
    batteryLevel: snapshot.batteryLevel,
    odometer: snapshot.odometer,
  }));

  const batteryCapacityKwh = vehicle?.batteryCapacityKwh ?? null;
  const totals = computeTripTotals(driveSegments, chargeSessions, batteryCapacityKwh);
  const driveSegmentsWithConsumption = driveSegments.map((segment) => ({
    ...segment,
    whPerKm: segmentWhPerKm(segment, batteryCapacityKwh),
  }));

  return NextResponse.json({
    trip,
    vehicle,
    driveSegments: driveSegmentsWithConsumption,
    chargeSessions,
    routeLog,
    batterySeries,
    totals,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid trip id" }, { status: 400 });
  }

  const deleted = await deleteTripCascade(id);
  if (!deleted) {
    return NextResponse.json({ error: "trip not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
