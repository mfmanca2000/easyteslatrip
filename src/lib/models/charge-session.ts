import { Collection, ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { DerivedChargeSession } from "@/lib/domain/derive-segments";

export interface ChargeSessionDoc {
  _id: ObjectId;
  tripId: ObjectId;
  vehicleId: ObjectId;
  startedAt: Date;
  endedAt: Date | null;
  startBatteryLevel: number;
  endBatteryLevel: number | null;
  energyAdded: number | null;
  latitude: number;
  longitude: number;
  placeName: string | null;
  costPerKwh: number | null;
  costTotal: number | null;
  free: boolean;
}

export interface ChargeSession {
  id: string;
  tripId: string;
  vehicleId: string;
  startedAt: string;
  endedAt: string | null;
  startBatteryLevel: number;
  endBatteryLevel: number | null;
  energyAdded: number | null;
  latitude: number;
  longitude: number;
  placeName: string | null;
  costPerKwh: number | null;
  costTotal: number | null;
  free: boolean;
}

// Derived + geocoded, keyed by its start time — the natural identity of a
// ChargeSession across repeated recomputation of the same trip. Cost fields
// are user-entered (not derived), so syncTripDerivedData carries them
// forward from the previous save the same way it carries placeName.
export type ChargeSessionToSave = DerivedChargeSession & {
  placeName: string | null;
  costPerKwh: number | null;
  costTotal: number | null;
  free: boolean;
};

function toChargeSession(doc: ChargeSessionDoc): ChargeSession {
  return {
    id: doc._id.toHexString(),
    tripId: doc.tripId.toHexString(),
    vehicleId: doc.vehicleId.toHexString(),
    startedAt: doc.startedAt.toISOString(),
    endedAt: doc.endedAt ? doc.endedAt.toISOString() : null,
    startBatteryLevel: doc.startBatteryLevel,
    endBatteryLevel: doc.endBatteryLevel,
    energyAdded: doc.energyAdded,
    latitude: doc.latitude,
    longitude: doc.longitude,
    placeName: doc.placeName,
    costPerKwh: doc.costPerKwh,
    costTotal: doc.costTotal,
    free: doc.free,
  };
}

async function getChargeSessionsCollection(): Promise<Collection<ChargeSessionDoc>> {
  const db = await getDb();
  return db.collection<ChargeSessionDoc>("chargeSessions");
}

export async function listChargeSessionsByTrip(tripId: string): Promise<ChargeSession[]> {
  const collection = await getChargeSessionsCollection();
  const docs = await collection
    .find({ tripId: new ObjectId(tripId) })
    .sort({ startedAt: 1 })
    .toArray();
  return docs.map(toChargeSession);
}

// Used by the All-time Stats page to aggregate across every completed Trip
// for a Vehicle in a single query.
export async function listChargeSessionsByTripIds(tripIds: string[]): Promise<ChargeSession[]> {
  if (tripIds.length === 0) return [];
  const collection = await getChargeSessionsCollection();
  const docs = await collection
    .find({ tripId: { $in: tripIds.map((id) => new ObjectId(id)) } })
    .sort({ startedAt: 1 })
    .toArray();
  return docs.map(toChargeSession);
}

// Replaces the full set of ChargeSessions for a trip with the freshly
// derived + geocoded set. Safe because the caller (syncTripDerivedData)
// recomputes from the full PollSnapshot history each time and carries
// forward any already-resolved place names.
export async function saveChargeSessions(
  tripId: string,
  vehicleId: string,
  sessions: ChargeSessionToSave[],
): Promise<void> {
  const collection = await getChargeSessionsCollection();
  await collection.deleteMany({ tripId: new ObjectId(tripId) });
  if (sessions.length === 0) return;

  const docs: ChargeSessionDoc[] = sessions.map((session) => ({
    _id: new ObjectId(),
    tripId: new ObjectId(tripId),
    vehicleId: new ObjectId(vehicleId),
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    startBatteryLevel: session.startBatteryLevel,
    endBatteryLevel: session.endBatteryLevel,
    energyAdded: session.energyAdded,
    latitude: session.latitude,
    longitude: session.longitude,
    placeName: session.placeName,
    costPerKwh: session.costPerKwh,
    costTotal: session.costTotal,
    free: session.free,
  }));
  await collection.insertMany(docs);
}

export interface ChargeSessionPatch {
  placeName?: string;
  costPerKwh?: number | null;
  costTotal?: number | null;
  free?: boolean;
}

export async function updateChargeSession(
  id: string,
  patch: ChargeSessionPatch,
): Promise<ChargeSession | null> {
  const collection = await getChargeSessionsCollection();
  const doc = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: patch },
    { returnDocument: "after" },
  );
  return doc ? toChargeSession(doc) : null;
}
