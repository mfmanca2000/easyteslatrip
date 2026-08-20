// Reverse geocoding via the Mapbox Geocoding API, used to resolve a place
// name at write-time when a DriveSegment or ChargeSession closes.

interface MapboxGeocodeResponse {
  features: { place_name: string }[];
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    throw new Error("Missing required env var: MAPBOX_TOKEN");
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}&limit=1`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Mapbox geocoding request failed: ${response.status}`);
  }

  const body: MapboxGeocodeResponse = await response.json();
  return body.features[0]?.place_name ?? null;
}
