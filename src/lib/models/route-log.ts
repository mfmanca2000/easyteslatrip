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

// Used by the trip list endpoint to decide whether each trip has a route
// worth showing a thumbnail for — projects just the point count so listing
// trips doesn't pull every route's full point data over the wire.
export async function getRouteLogPointCounts(tripIds: string[]): Promise<Record<string, number>> {
  if (tripIds.length === 0) return {};
  const collection = await getRouteLogsCollection();
  const docs = await collection
    .aggregate<{ tripId: ObjectId; count: number }>([
      { $match: { tripId: { $in: tripIds.map((id) => new ObjectId(id)) } } },
      { $project: { tripId: 1, count: { $size: "$points" } } },
    ])
    .toArray();
  const result: Record<string, number> = {};
  for (const doc of docs) {
    result[doc.tripId.toHexString()] = doc.count;
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
