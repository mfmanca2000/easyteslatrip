import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { updateVehicle } from "@/lib/models/vehicle";
import { deleteVehicleCascade } from "@/lib/domain/delete-vehicle";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid vehicle id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !("batteryCapacityKwh" in body)) {
    return NextResponse.json({ error: "batteryCapacityKwh is required" }, { status: 400 });
  }
  const { batteryCapacityKwh } = body;

  if (batteryCapacityKwh !== null && (typeof batteryCapacityKwh !== "number" || batteryCapacityKwh <= 0)) {
    return NextResponse.json(
      { error: "batteryCapacityKwh must be a positive number or null" },
      { status: 400 },
    );
  }

  const vehicle = await updateVehicle(id, { batteryCapacityKwh });
  if (!vehicle) {
    return NextResponse.json({ error: "vehicle not found" }, { status: 404 });
  }

  return NextResponse.json({ vehicle });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid vehicle id" }, { status: 400 });
  }

  const deleted = await deleteVehicleCascade(id);
  if (!deleted) {
    return NextResponse.json({ error: "vehicle not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
