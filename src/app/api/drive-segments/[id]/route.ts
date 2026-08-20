import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { updateDriveSegment, type DriveSegmentPatch } from "@/lib/models/drive-segment";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid drive segment id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const patch: DriveSegmentPatch = {};
  if (typeof body?.startPlaceName === "string") patch.startPlaceName = body.startPlaceName;
  if (typeof body?.endPlaceName === "string") patch.endPlaceName = body.endPlaceName;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no valid fields to update" }, { status: 400 });
  }

  const driveSegment = await updateDriveSegment(id, patch);
  if (!driveSegment) {
    return NextResponse.json({ error: "drive segment not found" }, { status: 404 });
  }

  return NextResponse.json({ driveSegment });
}
