import { Collection, ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { RoutePoint } from "@/lib/domain/derive-segments";

interface RouteLogDoc {
  _id: ObjectId;
  tripId: ObjectId;
  points: RoutePoint[];
}

async function getRouteLogsCollection(): Promise<Collection<RouteLogDoc>> {
  const db = await getDb();
  return db.collection<RouteLogDoc>("routeLogs");
}

export async function getRouteLog(tripId: string): Promise<RoutePoint[]> {
  const collection = await getRouteLogsCollection();
  const doc = await collection.findOne({ tripId: new ObjectId(tripId) });
  return doc?.points ?? [];
}

// Used by the trip list endpoint to render a route thumbnail per trip
// without one query per row.
export async function getRouteLogsByTripIds(
  tripIds: string[],
): Promise<Record<string, RoutePoint[]>> {
  if (tripIds.length === 0) return {};
  const collection = await getRouteLogsCollection();
  const docs = await collection
    .find({ tripId: { $in: tripIds.map((id) => new ObjectId(id)) } })
    .toArray();
  const result: Record<string, RoutePoint[]> = {};
  for (const doc of docs) {
    result[doc.tripId.toHexString()] = doc.points;
  }
  return result;
}

export async function replaceRouteLog(tripId: string, points: RoutePoint[]): Promise<void> {
  const collection = await getRouteLogsCollection();
  await collection.updateOne(
    { tripId: new ObjectId(tripId) },
    { $set: { points } },
    { upsert: true },
  );
}

export async function deleteRouteLog(tripId: string): Promise<void> {
  const collection = await getRouteLogsCollection();
  await collection.deleteOne({ tripId: new ObjectId(tripId) });
}
