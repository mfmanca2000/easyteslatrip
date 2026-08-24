import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { listTrips, startTrip, TripAlreadyActiveError, type Trip } from "@/lib/models/trip";
import { listDriveSegmentsByTripIds } from "@/lib/models/drive-segment";
import { getRouteLogsByTripIds } from "@/lib/models/route-log";
import { pollTripOnce } from "@/lib/domain/poll-trip";

// Route thumbnails only need enough points to trace the shape of the trip,
// not every polled fix — keeps the list payload small for trips with a
// long route log.
const THUMBNAIL_MAX_POINTS = 30;

function downsample<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => points[Math.round(i * step)]);
}

export interface TripListItem extends Trip {
  startPlaceName: string | null;
  endPlaceName: string | null;
  distanceKm: number | null;
  routePoints: { latitude: number; longitude: number }[];
}

export async function GET(request: NextRequest) {
  const vehicleId = request.nextUrl.searchParams.get("vehicleId");

  if (!vehicleId || !ObjectId.isValid(vehicleId)) {
    return NextResponse.json({ error: "vehicleId is required" }, { status: 400 });
  }

  const trips = await listTrips(vehicleId);
  const tripIds = trips.map((trip) => trip.id);
  const [segments, routeLogs] = await Promise.all([
    listDriveSegmentsByTripIds(tripIds),
    getRouteLogsByTripIds(tripIds),
  ]);

  const segmentsByTrip = new Map<string, typeof segments>();
  for (const segment of segments) {
    const list = segmentsByTrip.get(segment.tripId);
    if (list) list.push(segment);
    else segmentsByTrip.set(segment.tripId, [segment]);
  }

  const items: TripListItem[] = trips.map((trip) => {
    const tripSegments = segmentsByTrip.get(trip.id) ?? [];
    const first = tripSegments[0];
    const last = tripSegments[tripSegments.length - 1];
    const distanceKm = tripSegments.length
      ? tripSegments.reduce((sum, segment) => sum + (segment.distanceKm ?? 0), 0)
      : null;

    return {
      ...trip,
      startPlaceName: first?.startPlaceName ?? null,
      endPlaceName: trip.endedAt ? (last?.endPlaceName ?? null) : null,
      distanceKm,
      routePoints: downsample(routeLogs[trip.id] ?? [], THUMBNAIL_MAX_POINTS),
    };
  });

  return NextResponse.json({ trips: items });
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
