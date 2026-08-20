import { Collection, ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

export interface VehicleDoc {
  _id: ObjectId;
  name: string;
  entityPrefix: string;
  createdAt: Date;
}

export interface Vehicle {
  id: string;
  name: string;
  entityPrefix: string;
  createdAt: string;
}

function toVehicle(doc: VehicleDoc): Vehicle {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    entityPrefix: doc.entityPrefix,
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
}): Promise<Vehicle> {
  const collection = await getVehiclesCollection();
  const doc: VehicleDoc = {
    _id: new ObjectId(),
    name: input.name,
    entityPrefix: input.entityPrefix,
    createdAt: new Date(),
  };
  await collection.insertOne(doc);
  return toVehicle(doc);
}
