import { Collection, ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

export interface TripDoc {
  _id: ObjectId;
  vehicleId: ObjectId;
  startedAt: Date;
  endedAt: Date | null;
}

export interface Trip {
  id: string;
  vehicleId: string;
  startedAt: string;
  endedAt: string | null;
}

export class TripAlreadyActiveError extends Error {
  constructor(vehicleId: string) {
    super(`Vehicle ${vehicleId} already has an active trip`);
    this.name = "TripAlreadyActiveError";
  }
}

function toTrip(doc: TripDoc): Trip {
  return {
    id: doc._id.toHexString(),
    vehicleId: doc.vehicleId.toHexString(),
    startedAt: doc.startedAt.toISOString(),
    endedAt: doc.endedAt ? doc.endedAt.toISOString() : null,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

// Cached across calls (module-scoped, like getMongoClient's connection
// cache) so the partial unique index — the source of truth for "no
// overlapping trips per vehicle" — is only created once per process.
let indexPromise: Promise<unknown> | undefined;

async function getTripsCollection(): Promise<Collection<TripDoc>> {
  const db = await getDb();
  const collection = db.collection<TripDoc>("trips");
  if (!indexPromise) {
    indexPromise = collection.createIndex(
      { vehicleId: 1 },
      { unique: true, partialFilterExpression: { endedAt: null } },
    );
  }
  await indexPromise;
  return collection;
}

export async function listTrips(vehicleId: string): Promise<Trip[]> {
  const collection = await getTripsCollection();
  const docs = await collection
    .find({ vehicleId: new ObjectId(vehicleId) })
    .sort({ startedAt: -1 })
    .toArray();
  return docs.map(toTrip);
}

export async function getTrip(id: string): Promise<Trip | null> {
  const collection = await getTripsCollection();
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  return doc ? toTrip(doc) : null;
}

export async function getActiveTrip(vehicleId: string): Promise<Trip | null> {
  const collection = await getTripsCollection();
  const doc = await collection.findOne({
    vehicleId: new ObjectId(vehicleId),
    endedAt: null,
  });
  return doc ? toTrip(doc) : null;
}

// Used by the poll-trigger endpoint, which checks across all vehicles
// before deciding whether to call HA at all.
export async function getAnyActiveTrip(): Promise<Trip | null> {
  const collection = await getTripsCollection();
  const doc = await collection.findOne({ endedAt: null });
  return doc ? toTrip(doc) : null;
}

export async function startTrip(vehicleId: string): Promise<Trip> {
  const collection = await getTripsCollection();
  const doc: TripDoc = {
    _id: new ObjectId(),
    vehicleId: new ObjectId(vehicleId),
    startedAt: new Date(),
    endedAt: null,
  };

  try {
    await collection.insertOne(doc);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new TripAlreadyActiveError(vehicleId);
    }
    throw error;
  }

  return toTrip(doc);
}

export async function stopTrip(tripId: string): Promise<Trip | null> {
  const collection = await getTripsCollection();
  const doc = await collection.findOneAndUpdate(
    { _id: new ObjectId(tripId), endedAt: null },
    { $set: { endedAt: new Date() } },
    { returnDocument: "after" },
  );
  return doc ? toTrip(doc) : null;
}
