import { Collection, ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { DerivedDriveSegment } from "@/lib/domain/derive-segments";

export interface DriveSegmentDoc {
  _id: ObjectId;
  tripId: ObjectId;
  vehicleId: ObjectId;
  startedAt: Date;
  endedAt: Date | null;
  startOdometer: number;
  endOdometer: number | null;
  distanceKm: number | null;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number | null;
  endLongitude: number | null;
  startPlaceName: string | null;
  endPlaceName: string | null;
}

export interface DriveSegment {
  id: string;
  tripId: string;
  vehicleId: string;
  startedAt: string;
  endedAt: string | null;
  startOdometer: number;
  endOdometer: number | null;
  distanceKm: number | null;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number | null;
  endLongitude: number | null;
  startPlaceName: string | null;
  endPlaceName: string | null;
}

// Derived + geocoded, keyed by its start time — the natural identity of a
// DriveSegment across repeated recomputation of the same trip.
export type DriveSegmentToSave = DerivedDriveSegment & {
  startPlaceName: string | null;
  endPlaceName: string | null;
};

function toDriveSegment(doc: DriveSegmentDoc): DriveSegment {
  return {
    id: doc._id.toHexString(),
    tripId: doc.tripId.toHexString(),
    vehicleId: doc.vehicleId.toHexString(),
    startedAt: doc.startedAt.toISOString(),
    endedAt: doc.endedAt ? doc.endedAt.toISOString() : null,
    startOdometer: doc.startOdometer,
    endOdometer: doc.endOdometer,
    distanceKm: doc.distanceKm,
    startLatitude: doc.startLatitude,
    startLongitude: doc.startLongitude,
    endLatitude: doc.endLatitude,
    endLongitude: doc.endLongitude,
    startPlaceName: doc.startPlaceName,
    endPlaceName: doc.endPlaceName,
  };
}

async function getDriveSegmentsCollection(): Promise<Collection<DriveSegmentDoc>> {
  const db = await getDb();
  return db.collection<DriveSegmentDoc>("driveSegments");
}

export async function listDriveSegmentsByTrip(tripId: string): Promise<DriveSegment[]> {
  const collection = await getDriveSegmentsCollection();
  const docs = await collection
    .find({ tripId: new ObjectId(tripId) })
    .sort({ startedAt: 1 })
    .toArray();
  return docs.map(toDriveSegment);
}

// Replaces the full set of DriveSegments for a trip with the freshly
// derived + geocoded set. Safe because the caller (syncTripDerivedData)
// recomputes from the full PollSnapshot history each time and carries
// forward any already-resolved place names.
export async function saveDriveSegments(
  tripId: string,
  vehicleId: string,
  segments: DriveSegmentToSave[],
): Promise<void> {
  const collection = await getDriveSegmentsCollection();
  await collection.deleteMany({ tripId: new ObjectId(tripId) });
  if (segments.length === 0) return;

  const docs: DriveSegmentDoc[] = segments.map((segment) => ({
    _id: new ObjectId(),
    tripId: new ObjectId(tripId),
    vehicleId: new ObjectId(vehicleId),
    startedAt: segment.startedAt,
    endedAt: segment.endedAt,
    startOdometer: segment.startOdometer,
    endOdometer: segment.endOdometer,
    distanceKm: segment.distanceKm,
    startLatitude: segment.startLatitude,
    startLongitude: segment.startLongitude,
    endLatitude: segment.endLatitude,
    endLongitude: segment.endLongitude,
    startPlaceName: segment.startPlaceName,
    endPlaceName: segment.endPlaceName,
  }));
  await collection.insertMany(docs);
}
