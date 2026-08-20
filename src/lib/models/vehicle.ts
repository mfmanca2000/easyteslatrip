import { Collection, ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

export interface VehicleDoc {
  _id: ObjectId;
  name: string;
  entityPrefix: string;
  // User-entered usable battery pack capacity, needed to turn a battery %
  // drop over a DriveSegment into a Wh/km figure (HA exposes no
  // energy-consumed sensor directly). Null until the user sets it.
  batteryCapacityKwh: number | null;
  createdAt: Date;
}

export interface Vehicle {
  id: string;
  name: string;
  entityPrefix: string;
  batteryCapacityKwh: number | null;
  createdAt: string;
}

function toVehicle(doc: VehicleDoc): Vehicle {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    entityPrefix: doc.entityPrefix,
    batteryCapacityKwh: doc.batteryCapacityKwh ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

async function getVehiclesCollection(): Promise<Collection<VehicleDoc>> {
  const db = await getDb();
  return db.collection<VehicleDoc>("vehicles");
}

export async function listVehicles(): Promise<Vehicle[]> {
  const collection = await getVehiclesCollection();
  const docs = await collection.find().sort({ name: 1 }).toArray();
  return docs.map(toVehicle);
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const collection = await getVehiclesCollection();
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  return doc ? toVehicle(doc) : null;
}

export async function createVehicle(input: {
  name: string;
  entityPrefix: string;
  batteryCapacityKwh?: number | null;
}): Promise<Vehicle> {
  const collection = await getVehiclesCollection();
  const doc: VehicleDoc = {
    _id: new ObjectId(),
    name: input.name,
    entityPrefix: input.entityPrefix,
    batteryCapacityKwh: input.batteryCapacityKwh ?? null,
    createdAt: new Date(),
  };
  await collection.insertOne(doc);
  return toVehicle(doc);
}

export interface VehiclePatch {
  batteryCapacityKwh?: number | null;
}

export async function updateVehicle(id: string, patch: VehiclePatch): Promise<Vehicle | null> {
  const collection = await getVehiclesCollection();
  const doc = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: patch },
    { returnDocument: "after" },
  );
  return doc ? toVehicle(doc) : null;
}

export async function deleteVehicle(id: string): Promise<boolean> {
  const collection = await getVehiclesCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
