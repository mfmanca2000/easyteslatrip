import { NextRequest, NextResponse } from "next/server";
import { createVehicle, listVehicles } from "@/lib/models/vehicle";

export async function GET() {
  const vehicles = await listVehicles();
  return NextResponse.json({ vehicles });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { name, entityPrefix } = body ?? {};

  if (typeof name !== "string" || !name.trim() || typeof entityPrefix !== "string" || !entityPrefix.trim()) {
    return NextResponse.json(
      { error: "name and entityPrefix are required" },
      { status: 400 },
    );
  }

  const vehicle = await createVehicle({ name, entityPrefix });
  return NextResponse.json({ vehicle }, { status: 201 });
}
