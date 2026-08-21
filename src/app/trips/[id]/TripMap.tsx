"use client";

import { useEffect, useMemo, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import styles from "./page.module.css";

export interface MapPin {
  latitude: number;
  longitude: number;
  kind: "drive" | "charge" | "start" | "end" | "current";
}

interface TripMapProps {
  routeLog: { latitude: number; longitude: number }[];
  pins: MapPin[];
}

const PIN_COLOR: Record<Exclude<MapPin["kind"], "current">, string> = {
  start: "#3ddc97",
  end: "#5b8cff",
  drive: "#5b8cff",
  charge: "#ffb454",
};

// The "current" pin (last known position while a trip is still active) gets
// a custom pulsing element instead of a plain color pin — it's often the
// only marker on the map (a parked/idle car has no closed DriveSegment or
// ChargeSession yet) and needs to read unambiguously as "live," not as a
// completed leg's start/end point.
function buildCurrentPositionElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = styles.currentDot;
  return el;
}

export default function TripMap({ routeLog, pins }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  // A stable content fingerprint, not the array references: unrelated edits
  // elsewhere on the page (e.g. a leg's cost) produce new routeLog/pins
  // array instances on every render, which would otherwise tear down and
  // rebuild the whole Mapbox map (refetching tiles, visible flicker) even
  // though the route/pin data itself hasn't changed.
  const routeSignature = useMemo(
    () => routeLog.map((p) => `${p.latitude},${p.longitude}`).join(";"),
    [routeLog],
  );
  const pinsSignature = useMemo(
    () => pins.map((p) => `${p.kind}:${p.latitude},${p.longitude}`).join(";"),
    [pins],
  );

  useEffect(() => {
    if (!token || !containerRef.current || routeLog.length === 0) return;

    let map: import("mapbox-gl").Map | undefined;
    let cancelled = false;

    import("mapbox-gl").then((mapboxgl) => {
      if (cancelled || !containerRef.current) return;
      mapboxgl.default.accessToken = token;

      const bounds = new mapboxgl.default.LngLatBounds();
      routeLog.forEach((point) => bounds.extend([point.longitude, point.latitude]));

      map = new mapboxgl.default.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        bounds,
        fitBoundsOptions: { padding: 32 },
      });

      map.on("load", () => {
        if (!map) return;
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: routeLog.map((point) => [point.longitude, point.latitude]),
            },
          },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: { "line-color": "#5b8cff", "line-width": 3, "line-dasharray": [2, 1.5] },
        });

        pins.forEach((pin) => {
          const marker =
            pin.kind === "current"
              ? new mapboxgl.default.Marker({ element: buildCurrentPositionElement() })
              : new mapboxgl.default.Marker({ color: PIN_COLOR[pin.kind] });
          marker.setLngLat([pin.longitude, pin.latitude]).addTo(map!);
        });
      });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on content signatures, not array identity; see comment above
  }, [token, routeSignature, pinsSignature]);

  if (!token || routeLog.length === 0) {
    return (
      <div className={styles.mapfake}>
        <div className={styles.mapLabel}>
          {routeLog.length === 0 ? "No route data yet" : "Map unavailable — set NEXT_PUBLIC_MAPBOX_TOKEN"}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mapfake}>
      <div ref={containerRef} className={styles.mapCanvas} />
    </div>
  );
}
