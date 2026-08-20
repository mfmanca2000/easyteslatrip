import { Collection, ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { VehicleSnapshot } from "@/lib/ha";

export interface PollSnapshotDoc {
  _id: ObjectId;
  tripId: ObjectId;
  vehicleId: ObjectId;
  polledAt: Date;
  batteryLevel: number;
  shiftState: string;
  charging: boolean;
  pluggedIn: boolean;
  chargingState: string;
  energyAdded: number;
  odometer: number;
  chargerPower: number;
  latitude: number;
  longitude: number;
}

export interface PollSnapshot {
  id: string;
  tripId: string;
  vehicleId: string;
  polledAt: string;
  batteryLevel: number;
  shiftState: string;
  charging: boolean;
  pluggedIn: boolean;
  chargingState: string;
  energyAdded: number;
  odometer: number;
  chargerPower: number;
  latitude: number;
  longitude: number;
}

function toPollSnapshot(doc: PollSnapshotDoc): PollSnapshot {
  return {
    id: doc._id.toHexString(),
    tripId: doc.tripId.toHexString(),
    vehicleId: doc.vehicleId.toHexString(),
    polledAt: doc.polledAt.toISOString(),
    batteryLevel: doc.batteryLevel,
    shiftState: doc.shiftState,
    charging: doc.charging,
    pluggedIn: doc.pluggedIn,
    chargingState: doc.chargingState,
    energyAdded: doc.energyAdded,
    odometer: doc.odometer,
    chargerPower: doc.chargerPower,
    latitude: doc.latitude,
    longitude: doc.longitude,
  };
}

async function getPollSnapshotsCollection(): Promise<Collection<PollSnapshotDoc>> {
  const db = await getDb();
  return db.collection<PollSnapshotDoc>("pollSnapshots");
}

export async function createPollSnapshot(
  input: VehicleSnapshot & { tripId: string; vehicleId: string },
): Promise<PollSnapshot> {
  const collection = await getPollSnapshotsCollection();
  const doc: PollSnapshotDoc = {
    _id: new ObjectId(),
    tripId: new ObjectId(input.tripId),
    vehicleId: new ObjectId(input.vehicleId),
    polledAt: new Date(),
    batteryLevel: input.batteryLevel,
    shiftState: input.shiftState,
    charging: input.charging,
    pluggedIn: input.pluggedIn,
    chargingState: input.chargingState,
    energyAdded: input.energyAdded,
    odometer: input.odometer,
    chargerPower: input.chargerPower,
    latitude: input.latitude,
    longitude: input.longitude,
  };
  await collection.insertOne(doc);
  return toPollSnapshot(doc);
}

export async function listPollSnapshotsByTrip(tripId: string): Promise<PollSnapshot[]> {
  const collection = await getPollSnapshotsCollection();
  const docs = await collection
    .find({ tripId: new ObjectId(tripId) })
    .sort({ polledAt: 1, _id: 1 })
    .toArray();
  return docs.map(toPollSnapshot);
}
