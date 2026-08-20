import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { updateChargeSession, type ChargeSessionPatch } from "@/lib/models/charge-session";

function isNumberOrNull(value: unknown): value is number | null {
  return typeof value === "number" || value === null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid charge session id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "no valid fields to update" }, { status: 400 });
  }

  const patch: ChargeSessionPatch = {};
  if (typeof body.placeName === "string") patch.placeName = body.placeName;
  if ("costPerKwh" in body && isNumberOrNull(body.costPerKwh)) patch.costPerKwh = body.costPerKwh;
  if ("costTotal" in body && isNumberOrNull(body.costTotal)) patch.costTotal = body.costTotal;
  if (typeof body.free === "boolean") patch.free = body.free;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no valid fields to update" }, { status: 400 });
  }

  const chargeSession = await updateChargeSession(id, patch);
  if (!chargeSession) {
    return NextResponse.json({ error: "charge session not found" }, { status: 404 });
  }

  return NextResponse.json({ chargeSession });
}
