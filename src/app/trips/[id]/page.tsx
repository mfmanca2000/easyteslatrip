"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./page.module.css";
import TripMap, { type MapPin } from "./TripMap";

interface Vehicle {
  id: string;
  name: string;
  entityPrefix: string;
}

interface Trip {
  id: string;
  vehicleId: string;
  startedAt: string;
  endedAt: string | null;
}

interface DriveSegment {
  id: string;
  startedAt: string;
  endedAt: string | null;
  distanceKm: number | null;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number | null;
  endLongitude: number | null;
  startPlaceName: string | null;
  endPlaceName: string | null;
}

interface ChargeSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  energyAdded: number | null;
  latitude: number;
  longitude: number;
  placeName: string | null;
  costPerKwh: number | null;
  costTotal: number | null;
  free: boolean;
}

interface RoutePoint {
  latitude: number;
  longitude: number;
}

interface BatteryPoint {
  polledAt: string;
  batteryLevel: number;
}

interface TripTotals {
  distanceKm: number;
  drivingMinutes: number;
  chargingMinutes: number;
  energyAddedKwh: number;
  totalCost: number;
  allChargesFree: boolean;
}

interface TripDetail {
  trip: Trip;
  vehicle: Vehicle | null;
  driveSegments: DriveSegment[];
  chargeSessions: ChargeSession[];
  routeLog: RoutePoint[];
  batterySeries: BatteryPoint[];
  totals: TripTotals;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

function formatTime(iso: string | null): string {
  return iso ? timeFormatter.format(new Date(iso)) : "…";
}

function formatDateRange(trip: Trip): string {
  const start = new Date(trip.startedAt);
  if (!trip.endedAt) return `since ${timeFormatter.format(start)}`;
  const end = new Date(trip.endedAt);
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay
    ? `${dateFormatter.format(start)} · ${timeFormatter.format(start)}–${timeFormatter.format(end)}`
    : `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

function parseNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : n;
}

function formatKm(km: number): string {
  return `${Math.round(km)} km`;
}

function formatCost(session: ChargeSession): string {
  if (session.free) return "Free";
  if (session.costTotal != null) return `€${session.costTotal.toFixed(2)}`;
  if (session.costPerKwh != null) return `€${session.costPerKwh.toFixed(2)}/kWh`;
  return "—";
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((body as { error?: string } | null)?.error ?? `Request failed (${response.status})`);
  }
  return body as T;
}

type Leg =
  | { type: "drive"; startedAt: string; segment: DriveSegment }
  | { type: "charge"; startedAt: string; session: ChargeSession };

function buildLegs(detail: TripDetail): Leg[] {
  const legs: Leg[] = [
    ...detail.driveSegments.map((segment) => ({ type: "drive" as const, startedAt: segment.startedAt, segment })),
    ...detail.chargeSessions.map((session) => ({ type: "charge" as const, startedAt: session.startedAt, session })),
  ];
  return legs.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
}

function buildBatteryChartPoints(series: BatteryPoint[]): string {
  if (series.length === 0) return "";
  const width = 300;
  const height = 90;
  const pad = 6;
  return series
    .map((point, i) => {
      const x = series.length === 1 ? width / 2 : (i / (series.length - 1)) * width;
      const y = height - pad - (point.batteryLevel / 100) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildMapPins(detail: TripDetail): MapPin[] {
  const pins: MapPin[] = [];
  detail.driveSegments.forEach((segment, i) => {
    if (i === 0) pins.push({ latitude: segment.startLatitude, longitude: segment.startLongitude, kind: "start" });
    if (segment.endLatitude != null && segment.endLongitude != null) {
      pins.push({ latitude: segment.endLatitude, longitude: segment.endLongitude, kind: "end" });
    }
  });
  detail.chargeSessions.forEach((session) => {
    pins.push({ latitude: session.latitude, longitude: session.longitude, kind: "charge" });
  });
  return pins;
}

function DriveSegmentEditForm({
  segment,
  onCancel,
  onSave,
}: {
  segment: DriveSegment;
  onCancel: () => void;
  onSave: (patch: { startPlaceName?: string; endPlaceName?: string }) => Promise<void>;
}) {
  const [startPlaceName, setStartPlaceName] = useState(segment.startPlaceName ?? "");
  const [endPlaceName, setEndPlaceName] = useState(segment.endPlaceName ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const patch: { startPlaceName?: string; endPlaceName?: string } = {};
      if (startPlaceName.trim()) patch.startPlaceName = startPlaceName;
      // The end-place input is disabled (and its value meaningless) while
      // the segment is still open, so never send it in that case.
      if (segment.endedAt && endPlaceName.trim()) patch.endPlaceName = endPlaceName;
      await onSave(patch);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.editForm}>
      <label className={styles.editRow}>
        Start place
        <input
          className={styles.editInput}
          value={startPlaceName}
          onChange={(e) => setStartPlaceName(e.target.value)}
        />
      </label>
      <label className={styles.editRow}>
        End place
        <input
          className={styles.editInput}
          value={endPlaceName}
          onChange={(e) => setEndPlaceName(e.target.value)}
          disabled={!segment.endedAt}
        />
      </label>
      <div className={styles.editActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

type CostMode = "perKwh" | "total" | "free";

function ChargeSessionEditForm({
  session,
  onCancel,
  onSave,
}: {
  session: ChargeSession;
  onCancel: () => void;
  onSave: (patch: {
    placeName?: string;
    costPerKwh?: number | null;
    costTotal?: number | null;
    free?: boolean;
  }) => Promise<void>;
}) {
  const [placeName, setPlaceName] = useState(session.placeName ?? "");
  const [mode, setMode] = useState<CostMode>(
    session.free ? "free" : session.costTotal != null ? "total" : "perKwh",
  );
  const [costPerKwh, setCostPerKwh] = useState(session.costPerKwh != null ? String(session.costPerKwh) : "");
  const [costTotal, setCostTotal] = useState(session.costTotal != null ? String(session.costTotal) : "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const patch: {
        placeName?: string;
        costPerKwh: number | null;
        costTotal: number | null;
        free: boolean;
      } = {
        free: mode === "free",
        costPerKwh: mode === "perKwh" ? parseNumberOrNull(costPerKwh) : null,
        costTotal: mode === "total" ? parseNumberOrNull(costTotal) : null,
      };
      if (placeName.trim()) patch.placeName = placeName;
      await onSave(patch);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.editForm}>
      <label className={styles.editRow}>
        Place
        <input className={styles.editInput} value={placeName} onChange={(e) => setPlaceName(e.target.value)} />
      </label>
      <div className={styles.costModeRow}>
        <button
          type="button"
          className={`${styles.costModeBtn} ${mode === "perKwh" ? styles.costModeBtnActive : ""}`}
          onClick={() => setMode("perKwh")}
        >
          €/kWh
        </button>
        <button
          type="button"
          className={`${styles.costModeBtn} ${mode === "total" ? styles.costModeBtnActive : ""}`}
          onClick={() => setMode("total")}
        >
          Total €
        </button>
        <button
          type="button"
          className={`${styles.costModeBtn} ${mode === "free" ? styles.costModeBtnActive : ""}`}
          onClick={() => setMode("free")}
        >
          Free
        </button>
      </div>
      {mode === "perKwh" && (
        <label className={styles.editRow}>
          €/kWh
          <input
            className={styles.editInput}
            type="number"
            step="0.01"
            value={costPerKwh}
            onChange={(e) => setCostPerKwh(e.target.value)}
          />
        </label>
      )}
      {mode === "total" && (
        <label className={styles.editRow}>
          Total €
          <input
            className={styles.editInput}
            type="number"
            step="0.01"
            value={costTotal}
            onChange={(e) => setCostTotal(e.target.value)}
          />
        </label>
      )}
      <div className={styles.editActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingLegId, setEditingLegId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<TripDetail>(`/api/trips/${params.id}`)
      .then((body) => {
        if (!cancelled) setDetail(body);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load trip");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const legs = useMemo(() => (detail ? buildLegs(detail) : []), [detail]);
  const mapPins = useMemo(() => (detail ? buildMapPins(detail) : []), [detail]);
  const batteryPoints = useMemo(
    () => (detail ? buildBatteryChartPoints(detail.batterySeries) : ""),
    [detail],
  );

  async function saveDriveSegment(id: string, patch: { startPlaceName?: string; endPlaceName?: string }) {
    const body = await fetchJson<{ driveSegment: DriveSegment }>(`/api/drive-segments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setDetail((current) =>
      current
        ? {
            ...current,
            driveSegments: current.driveSegments.map((s) => (s.id === id ? body.driveSegment : s)),
          }
        : current,
    );
    setEditingLegId(null);
  }

  async function saveChargeSession(
    id: string,
    patch: { placeName?: string; costPerKwh?: number | null; costTotal?: number | null; free?: boolean },
  ) {
    const body = await fetchJson<{ chargeSession: ChargeSession }>(`/api/charge-sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setDetail((current) =>
      current
        ? {
            ...current,
            chargeSessions: current.chargeSessions.map((s) => (s.id === id ? body.chargeSession : s)),
          }
        : current,
    );
    setEditingLegId(null);
  }

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>Loading trip…</p>
      </div>
    );
  }

  const { trip, vehicle, totals, batterySeries } = detail;
  const firstBattery = batterySeries[0]?.batteryLevel;
  const lastBattery = batterySeries[batterySeries.length - 1]?.batteryLevel;

  return (
    <div className={styles.page}>
      <div className={`${styles.appbar} ${styles.container}`} style={{ maxWidth: "none" }}>
        <button type="button" className={styles.back} onClick={() => router.push("/")} aria-label="Back">
          ‹
        </button>
        <div className={styles.title}>
          <h1>{legs[0]?.type === "drive" ? legs[0].segment.startPlaceName ?? "Trip" : "Trip"}</h1>
          <div className={styles.titleSub}>{formatDateRange(trip)}</div>
        </div>
        {vehicle && <div className={styles.vehTag}>🚗 {vehicle.name}</div>}
      </div>

      <div className={styles.container}>
        <TripMap routeLog={detail.routeLog} pins={mapPins} />

        <h2 className={styles.sectiontitle}>Battery over trip</h2>
        <div className={styles.chart}>
          <div className={styles.chartHd}>
            <span>Battery %</span>
            <span>
              {firstBattery != null && lastBattery != null ? `${firstBattery}% → ${lastBattery}%` : "No data yet"}
            </span>
          </div>
          {batteryPoints && (
            <svg viewBox="0 0 300 90" preserveAspectRatio="none">
              <polyline className={styles.chartLine} points={batteryPoints} />
            </svg>
          )}
        </div>

        <h2 className={styles.sectiontitle}>Legs</h2>
        {legs.length === 0 ? (
          <p className={styles.empty}>No legs recorded yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Leg</th>
                <th>Place</th>
                <th>Time</th>
                <th style={{ textAlign: "right" }}>Stat</th>
              </tr>
            </thead>
            <tbody>
              {legs.map((leg) => {
                const id = leg.type === "drive" ? leg.segment.id : leg.session.id;
                const isEditing = editingLegId === id;
                return (
                  <Fragment key={id}>
                    <tr>
                      <td>
                        <span className={`${styles.tag} ${leg.type === "drive" ? styles.tagDrive : styles.tagCharge}`}>
                          {leg.type === "drive" ? "Drive" : "Charge"}
                        </span>
                      </td>
                      <td>
                        <div className={styles.placeRow}>
                          {leg.type === "drive" ? (
                            <span>
                              {leg.segment.startPlaceName ?? "Unknown"}
                              {leg.segment.endPlaceName && (
                                <span className={styles.placeSub}>→ {leg.segment.endPlaceName}</span>
                              )}
                            </span>
                          ) : (
                            <span>{leg.session.placeName ?? "Unknown"}</span>
                          )}
                          <button
                            type="button"
                            className={styles.editBtn}
                            onClick={() => setEditingLegId(isEditing ? null : id)}
                          >
                            {isEditing ? "close" : "edit"}
                          </button>
                        </div>
                      </td>
                      <td>
                        {formatTime(leg.startedAt)}–{formatTime(leg.type === "drive" ? leg.segment.endedAt : leg.session.endedAt)}
                        <span className={styles.placeSub}>
                          {formatDuration(
                            (new Date(
                              (leg.type === "drive" ? leg.segment.endedAt : leg.session.endedAt) ?? leg.startedAt,
                            ).getTime() -
                              new Date(leg.startedAt).getTime()) /
                              60_000,
                          )}
                        </span>
                      </td>
                      <td className={styles.stat}>
                        {leg.type === "drive" ? (
                          leg.segment.distanceKm != null ? formatKm(leg.segment.distanceKm) : "…"
                        ) : (
                          <>
                            {leg.session.energyAdded != null ? `+${leg.session.energyAdded} kWh` : "…"}
                            <span className={styles.statSub}>{formatCost(leg.session)}</span>
                          </>
                        )}
                      </td>
                    </tr>
                    {isEditing && (
                      <tr>
                        <td colSpan={4}>
                          {leg.type === "drive" ? (
                            <DriveSegmentEditForm
                              segment={leg.segment}
                              onCancel={() => setEditingLegId(null)}
                              onSave={(patch) => saveDriveSegment(leg.segment.id, patch)}
                            />
                          ) : (
                            <ChargeSessionEditForm
                              session={leg.session}
                              onCancel={() => setEditingLegId(null)}
                              onSave={(patch) => saveChargeSession(leg.session.id, patch)}
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}

        <h2 className={styles.sectiontitle}>Trip totals</h2>
        <div className={styles.kpi}>
          <div className={styles.kpiStat}>
            <div className={styles.kpiV}>{formatKm(totals.distanceKm)}</div>
            <div className={styles.kpiL}>Distance</div>
          </div>
          <div className={styles.kpiStat}>
            <div className={styles.kpiV}>{formatDuration(totals.drivingMinutes)}</div>
            <div className={styles.kpiL}>Driving time</div>
          </div>
          <div className={styles.kpiStat}>
            <div className={styles.kpiV}>{formatDuration(totals.chargingMinutes)}</div>
            <div className={styles.kpiL}>Charging time</div>
          </div>
          <div className={styles.kpiStat}>
            <div className={styles.kpiV}>{totals.energyAddedKwh.toFixed(0)} kWh</div>
            <div className={styles.kpiL}>Energy added</div>
          </div>
          <div className={`${styles.kpiStat} ${styles.kpiWide}`}>
            <div>
              <div className={styles.kpiL}>Total cost</div>
              <div className={styles.kpiV}>
                {totals.allChargesFree ? "Free" : `€${totals.totalCost.toFixed(2)}`}
              </div>
            </div>
            <div style={{ fontSize: "22px" }}>⚡</div>
          </div>
        </div>
      </div>
    </div>
  );
}
