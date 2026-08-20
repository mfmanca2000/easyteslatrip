import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { stopTrip } from "@/lib/models/trip";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid trip id" }, { status: 400 });
  }

  const trip = await stopTrip(id);

  if (!trip) {
    return NextResponse.json(
      { error: "trip not found or already stopped" },
      { status: 404 },
    );
  }

  return NextResponse.json({ trip });
}
