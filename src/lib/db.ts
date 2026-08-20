import getMongoClient from "@/lib/mongodb";

const dbName = process.env.MONGODB_DB ?? "easyteslatrip";

export async function getDb() {
  const client = await getMongoClient();
  return client.db(dbName);
}
