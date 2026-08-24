import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getTrip } from "@/lib/models/trip";
import { getRouteLog } from "@/lib/models/route-log";
import { getTripThumbnail, saveTripThumbnail } from "@/lib/models/trip-thumbnail";
import { buildStaticMapUrl, downsampleRoutePoints } from "@/lib/route-thumbnail";

const THUMBNAIL_MAX_POINTS = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid trip id" }, { status: 400 });
  }

  const trip = await getTrip(id);
  if (!trip) {
    return NextResponse.json({ error: "trip not found" }, { status: 404 });
  }

  // A completed trip's route never changes, so its thumbnail can be cached
  // forever once generated — avoids hitting the Mapbox API on every page
  // load. An in-progress trip's route keeps growing, so it's always
  // rendered live and never cached.
  if (trip.endedAt) {
    const cached = await getTripThumbnail(id);
    if (cached) {
      return new NextResponse(new Uint8Array(cached.data), {
        headers: {
          "Content-Type": cached.contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  const token = process.env.MAPBOX_TOKEN;
  const points = downsampleRoutePoints(await getRouteLog(id), THUMBNAIL_MAX_POINTS);
  const mapUrl = token ? buildStaticMapUrl(points, token) : null;
  if (!mapUrl) {
    return NextResponse.json({ error: "no route available" }, { status: 404 });
  }

  const upstream = await fetch(mapUrl);
  if (!upstream.ok) {
    return NextResponse.json({ error: "failed to fetch map" }, { status: 502 });
  }
  const contentType = upstream.headers.get("content-type") ?? "image/png";
  const data = Buffer.from(await upstream.arrayBuffer());

  if (trip.endedAt) {
    await saveTripThumbnail(id, data, contentType);
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": trip.endedAt ? "public, max-age=31536000, immutable" : "no-store",
    },
  });
}
