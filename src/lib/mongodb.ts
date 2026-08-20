import { MongoClient } from "mongodb";

// Reuse the client (and its connection pool) across hot reloads / warm
// serverless invocations instead of opening a new one on every call.
// Connecting lazily (rather than at module load) keeps this importable
// during `next build`'s page data collection, when env vars like
// MONGODB_URI aren't set.
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing required env var: MONGODB_URI");
  }
  const promise = new MongoClient(uri).connect();
  // Don't cache a rejected connection attempt — let the next call retry.
  promise.catch(() => {
    if (global._mongoClientPromise === promise) {
      global._mongoClientPromise = undefined;
    }
  });
  return promise;
}

export default function getMongoClient(): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = connect();
  }
  return global._mongoClientPromise;
}
