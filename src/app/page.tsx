"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

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

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

function formatActive(trip: Trip): string {
  return `since ${timeFormatter.format(new Date(trip.startedAt))}`;
}

function formatClosed(trip: Trip): string {
  const start = new Date(trip.startedAt);
  const end = new Date(trip.endedAt as string);
  const sameDay = start.toDateString() === end.toDateString();
  const dateLabel = sameDay
    ? dateFormatter.format(start)
    : `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;
  return `${dateLabel} · ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((body as { error?: string } | null)?.error ?? `Request failed (${response.status})`);
  }
  return body as T;
}

export default function TripListPage() {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    fetchJson<{ trips: Trip[] }>(`/api/trips?vehicleId=${selectedVehicleId}`)
      .then((body) => {
        if (!cancelled) setTrips(body.trips);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load trips");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVehicleId]);

  async function refreshTrips() {
    if (!selectedVehicleId) return;
    const body = await fetchJson<{ trips: Trip[] }>(`/api/trips?vehicleId=${selectedVehicleId}`);
    setTrips(body.trips);
  }

  async function handleStart() {
    if (!selectedVehicleId) return;
    setBusy(true);
    setError(null);
    try {
      await fetchJson("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: selectedVehicleId }),
      });
      await refreshTrips();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start trip");
    } finally {
      setBusy(false);
    }
  }

  async function handleStop(tripId: string) {
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/trips/${tripId}/stop`, { method: "POST" });
      await refreshTrips();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop trip");
    } finally {
      setBusy(false);
    }
  }

  const activeTrip = trips?.find((trip) => trip.endedAt === null) ?? null;
  const pastTrips = trips?.filter((trip) => trip.endedAt !== null) ?? [];

  return (
    <div className={styles.page}>
      <div className={`${styles.appbar} ${styles.container}`} style={{ maxWidth: "none" }}>
        <h1>Trips</h1>
        <button
          type="button"
          className={styles.startButton}
          disabled={busy || !selectedVehicleId || !!activeTrip}
          onClick={handleStart}
          aria-label="Start trip"
          title={activeTrip ? "A trip is already in progress" : "Start trip"}
        >
          +
        </button>
      </div>

      <div className={styles.container}>
        {vehicles === null ? (
          <p className={styles.empty}>Loading vehicles…</p>
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

            {error && <p className={styles.error}>{error}</p>}

            {trips === null ? (
              <p className={styles.empty}>Loading trips…</p>
            ) : (
              <>
                {activeTrip && (
                  <>
                    <h2 className={styles.sectiontitle}>In progress</h2>
                    <div className={`${styles.trip} ${styles.tripActive}`}>
                      <div className={styles.tripHead}>
                        <div className={styles.tripName}>🔴 Trip in progress</div>
                        <div className={styles.tripDates}>{formatActive(activeTrip)}</div>
                      </div>
                      <button
                        type="button"
                        className={styles.stopButton}
                        disabled={busy}
                        onClick={() => handleStop(activeTrip.id)}
                      >
                        Stop trip
                      </button>
                    </div>
                  </>
                )}

                <h2 className={styles.sectiontitle}>Past trips</h2>
                {pastTrips.length === 0 ? (
                  <p className={styles.empty}>No past trips yet.</p>
                ) : (
                  pastTrips.map((trip) => (
                    <Link key={trip.id} href={`/trips/${trip.id}`} className={styles.trip}>
                      <div className={styles.tripHead}>
                        <div className={styles.tripName}>Trip</div>
                        <div className={styles.tripDates}>{formatClosed(trip)}</div>
                      </div>
                    </Link>
                  ))
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
