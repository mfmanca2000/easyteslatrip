import { NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";

const dbName = process.env.MONGODB_DB ?? "easyteslatrip";

export async function GET() {
  try {
    const client = await getMongoClient();
    await client.db(dbName).command({ ping: 1 });
    return NextResponse.json({ status: "ok", mongo: "connected" });
  } catch (error) {
    console.error("Health check: mongo ping failed", error);
    return NextResponse.json(
      { status: "error", mongo: "disconnected" },
      { status: 503 },
    );
  }
}
