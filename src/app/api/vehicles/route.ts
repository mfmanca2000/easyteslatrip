import { NextRequest, NextResponse } from "next/server";
import { createVehicle, listVehicles } from "@/lib/models/vehicle";

export async function GET() {
  const vehicles = await listVehicles();
  return NextResponse.json({ vehicles });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { name, entityPrefix, batteryCapacityKwh } = body ?? {};

  if (typeof name !== "string" || !name.trim() || typeof entityPrefix !== "string" || !entityPrefix.trim()) {
    return NextResponse.json(
      { error: "name and entityPrefix are required" },
      { status: 400 },
    );
  }

  if (
    batteryCapacityKwh !== undefined &&
    batteryCapacityKwh !== null &&
    (typeof batteryCapacityKwh !== "number" || batteryCapacityKwh <= 0)
  ) {
    return NextResponse.json(
      { error: "batteryCapacityKwh must be a positive number" },
      { status: 400 },
    );
  }

  const vehicle = await createVehicle({ name, entityPrefix, batteryCapacityKwh: batteryCapacityKwh ?? null });
  return NextResponse.json({ vehicle }, { status: 201 });
}
