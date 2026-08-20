"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

interface Vehicle {
  id: string;
  name: string;
  entityPrefix: string;
}

interface VehicleStats {
  tripCount: number;
  distanceKm: number;
  drivingMinutes: number;
  chargingMinutes: number;
  energyAddedKwh: number;
  totalCost: number;
  allChargesFree: boolean;
  avgSpeedKmh: number;
}

async function fetchJson<T>(input: string): Promise<T> {
  const response = await fetch(input);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((body as { error?: string } | null)?.error ?? `Request failed (${response.status})`);
  }
  return body as T;
}

function formatKm(km: number): string {
  return `${Math.round(km)} km`;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

export default function StatsPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [stats, setStats] = useState<VehicleStats | null>(null);
  // Tracks which vehicle `stats` belongs to, so a slow response for a
  // previously-selected vehicle can never be rendered under a newer one.
  const [statsVehicleId, setStatsVehicleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{ vehicles: Vehicle[] }>("/api/vehicles")
      .then((body) => {
        setVehicles(body.vehicles);
        setSelectedVehicleId((current) => current ?? body.vehicles[0]?.id ?? null);
      })
      .catch(() => setError("Failed to load vehicles"));
  }, []);

  useEffect(() => {
    if (!selectedVehicleId) return;
    let cancelled = false;
    fetchJson<{ vehicle: Vehicle; stats: VehicleStats }>(`/api/vehicles/${selectedVehicleId}/stats`)
      .then((body) => {
        if (cancelled) return;
        setStats(body.stats);
        setStatsVehicleId(selectedVehicleId);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load stats");
        setStats(null);
        setStatsVehicleId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVehicleId]);

  const displayStats = statsVehicleId === selectedVehicleId ? stats : null;

  return (
    <div className={styles.page}>
      <div className={`${styles.appbar} ${styles.container}`} style={{ maxWidth: "none" }}>
        <button type="button" className={styles.back} onClick={() => router.push("/")} aria-label="Back">
          ‹
        </button>
        <div>
          <h1>All-time Stats</h1>
          <div className={styles.sub}>Everything recorded since you started tracking</div>
        </div>
      </div>

      <div className={styles.container}>
        {error && <p className={styles.error}>{error}</p>}

        {vehicles === null ? (
          error ? null : <p className={styles.empty}>Loading vehicles…</p>
        ) : vehicles.length === 0 ? (
          <p className={styles.empty}>No vehicles registered yet.</p>
        ) : (
          <>
            <div className={styles.vehtabs}>
              {vehicles.map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  className={`${styles.tab} ${vehicle.id === selectedVehicleId ? styles.tabActive : ""}`}
                  onClick={() => setSelectedVehicleId(vehicle.id)}
                >
                  🚗 {vehicle.name}
                </button>
              ))}
            </div>

            {displayStats === null ? (
              error ? null : <p className={styles.empty}>Loading stats…</p>
            ) : (
              <>
                <div className={styles.hero}>
                  <div className={styles.heroBig}>{formatKm(displayStats.distanceKm)}</div>
                  <div className={styles.heroLabel}>Total distance tracked</div>
                </div>

                <div className={styles.grid}>
                  <div className={styles.stat}>
                    <div className={styles.statV}>{displayStats.tripCount}</div>
                    <div className={styles.statL}>Trips</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.statV}>{formatDuration(displayStats.drivingMinutes)}</div>
                    <div className={styles.statL}>Driving time</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.statV}>{formatDuration(displayStats.chargingMinutes)}</div>
                    <div className={styles.statL}>Charging time</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.statV}>{displayStats.energyAddedKwh.toFixed(0)} kWh</div>
                    <div className={styles.statL}>Energy added</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.statV}>
                      {displayStats.allChargesFree ? "Free" : `€${displayStats.totalCost.toFixed(2)}`}
                    </div>
                    <div className={styles.statL}>Total charging cost</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.statV}>{Math.round(displayStats.avgSpeedKmh)} km/h</div>
                    <div className={styles.statL}>Avg. driving speed</div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
