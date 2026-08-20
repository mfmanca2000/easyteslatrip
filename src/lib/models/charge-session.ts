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
}

// Derived + geocoded, keyed by its start time — the natural identity of a
// ChargeSession across repeated recomputation of the same trip.
export type ChargeSessionToSave = DerivedChargeSession & {
  placeName: string | null;
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
  }));
  await collection.insertMany(docs);
}
