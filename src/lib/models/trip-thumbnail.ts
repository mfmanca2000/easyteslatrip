import { Collection, ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

// Keyed 1:1 on the trip's own _id — a completed trip's route is immutable,
// so there's never more than one cached thumbnail per trip to look up.
interface TripThumbnailDoc {
  _id: ObjectId;
  contentType: string;
  data: Buffer;
  generatedAt: Date;
}

export interface TripThumbnail {
  data: Buffer;
  contentType: string;
}

async function getCollection(): Promise<Collection<TripThumbnailDoc>> {
  const db = await getDb();
  return db.collection<TripThumbnailDoc>("tripThumbnails");
}

export async function getTripThumbnail(tripId: string): Promise<TripThumbnail | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ _id: new ObjectId(tripId) });
  // The driver reads binary fields back as a BSON Binary wrapper, not a
  // plain Buffer — unwrap it so callers get real image bytes.
  return doc ? { data: Buffer.from(doc.data.buffer), contentType: doc.contentType } : null;
}

export async function saveTripThumbnail(
  tripId: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  const collection = await getCollection();
  await collection.updateOne(
    { _id: new ObjectId(tripId) },
    { $set: { contentType, data, generatedAt: new Date() } },
    { upsert: true },
  );
}

export async function deleteTripThumbnail(tripId: string): Promise<void> {
  const collection = await getCollection();
  await collection.deleteOne({ _id: new ObjectId(tripId) });
}
