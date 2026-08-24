// Builds a Mapbox Static Images API URL showing a trip's route, for use as
// a small thumbnail on the trip list. See:
// https://docs.mapbox.com/api/maps/static-images/

interface RoutePoint {
  latitude: number;
  longitude: number;
}

// Google's Encoded Polyline Algorithm Format (precision 5), which is what
// Mapbox's `path` overlay expects.
export function encodePolyline(points: RoutePoint[]): string {
  let output = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const { latitude, longitude } of points) {
    const lat = Math.round(latitude * 1e5);
    const lng = Math.round(longitude * 1e5);
    output += encodeSignedNumber(lat - prevLat) + encodeSignedNumber(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }

  return output;
}

function encodeSignedNumber(num: number): string {
  let sgnNum = num << 1;
  if (num < 0) sgnNum = ~sgnNum;
  return encodeUnsignedNumber(sgnNum);
}

function encodeUnsignedNumber(num: number): string {
  let output = "";
  let value = num;
  while (value >= 0x20) {
    output += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
    value >>= 5;
  }
  return output + String.fromCharCode(value + 63);
}

// Thumbnails only need enough points to trace the shape of the route, not
// every polled fix — keeps the encoded path (and the request URL) short.
export function downsampleRoutePoints<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => points[Math.round(i * step)]);
}

export function buildStaticMapUrl(points: RoutePoint[], token: string): string | null {
  if (points.length < 2 || !token) return null;

  const overlay = `path-3+5b8cff-0.85(${encodeURIComponent(encodePolyline(points))})`;
  const url = new URL(`https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${overlay}/auto/128x128@2x`);
  url.searchParams.set("padding", "10");
  url.searchParams.set("access_token", token);
  return url.toString();
}
