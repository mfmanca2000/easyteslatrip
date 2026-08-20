"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

interface Vehicle {
  id: string;
  name: string;
  entityPrefix: string;
  batteryCapacityKwh: number | null;
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((body as { error?: string } | null)?.error ?? `Request failed (${response.status})`);
  }
  return body as T;
}

function parseNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : n;
}

function formatCapacity(kwh: number | null): string {
  return kwh != null ? `${kwh} kWh` : "Not set";
}

function CapacityEditForm({
  vehicle,
  onCancel,
  onSave,
}: {
  vehicle: Vehicle;
  onCancel: () => void;
  onSave: (batteryCapacityKwh: number | null) => Promise<void>;
}) {
  const [value, setValue] = useState(vehicle.batteryCapacityKwh != null ? String(vehicle.batteryCapacityKwh) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(parseNumberOrNull(value));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.editForm}>
      <label className={styles.editRow}>
        Battery pack capacity (kWh)
        <input
          className={styles.editInput}
          type="number"
          step="0.1"
          min="0"
          placeholder="e.g. 75"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      {error && <p className={styles.error}>{error}</p>}
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

function AddVehicleForm({ onCancel, onCreate }: { onCancel: () => void; onCreate: (input: {
  name: string;
  entityPrefix: string;
  batteryCapacityKwh: number | null;
}) => Promise<void> }) {
  const [name, setName] = useState("");
  const [entityPrefix, setEntityPrefix] = useState("");
  const [batteryCapacityKwh, setBatteryCapacityKwh] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim() || !entityPrefix.trim()) {
      setError("Name and entity prefix are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        entityPrefix: entityPrefix.trim(),
        batteryCapacityKwh: parseNumberOrNull(batteryCapacityKwh),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create vehicle");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.addForm}>
      <label className={styles.editRow}>
        Name
        <input className={styles.editInput} value={name} onChange={(e) => setName(e.target.value)} placeholder="Electra" />
      </label>
      <label className={styles.editRow}>
        HA entity prefix
        <input
          className={styles.editInput}
          value={entityPrefix}
          onChange={(e) => setEntityPrefix(e.target.value)}
          placeholder="electra"
        />
      </label>
      <label className={styles.editRow}>
        Battery pack capacity (kWh) — optional
        <input
          className={styles.editInput}
          type="number"
          step="0.1"
          min="0"
          placeholder="e.g. 75"
          value={batteryCapacityKwh}
          onChange={(e) => setBatteryCapacityKwh(e.target.value)}
        />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.editActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className={styles.saveBtn} onClick={handleCreate} disabled={saving}>
          {saving ? "Adding…" : "Add vehicle"}
        </button>
      </div>
    </div>
  );
}

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchJson<{ vehicles: Vehicle[] }>("/api/vehicles")
      .then((body) => setVehicles(body.vehicles))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load vehicles"));
  }, []);

  async function saveCapacity(id: string, batteryCapacityKwh: number | null) {
    const body = await fetchJson<{ vehicle: Vehicle }>(`/api/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batteryCapacityKwh }),
    });
    setVehicles((current) => current?.map((v) => (v.id === id ? body.vehicle : v)) ?? current);
    setEditingId(null);
  }

  async function createVehicle(input: { name: string; entityPrefix: string; batteryCapacityKwh: number | null }) {
    const body = await fetchJson<{ vehicle: Vehicle }>("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    setVehicles((current) => (current ? [...current, body.vehicle] : [body.vehicle]));
    setAdding(false);
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.appbar} ${styles.container}`} style={{ maxWidth: "none" }}>
        <button type="button" className={styles.back} onClick={() => router.push("/")} aria-label="Back">
          ‹
        </button>
        <h1>Vehicles</h1>
      </div>

      <div className={styles.container}>
        {error && <p className={styles.error}>{error}</p>}

        {vehicles === null ? (
          error ? null : <p className={styles.empty}>Loading vehicles…</p>
        ) : (
          <>
            <h2 className={styles.sectiontitle}>Registered vehicles</h2>
            {vehicles.length === 0 ? (
              <p className={styles.empty}>No vehicles registered yet.</p>
            ) : (
              vehicles.map((vehicle) => (
                <div key={vehicle.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <div>
                      <div className={styles.cardName}>🚗 {vehicle.name}</div>
                      <div className={styles.cardPrefix}>{vehicle.entityPrefix}</div>
                    </div>
                    <button
                      type="button"
                      className={styles.editBtn}
                      onClick={() => setEditingId(editingId === vehicle.id ? null : vehicle.id)}
                    >
                      {editingId === vehicle.id ? "close" : "edit"}
                    </button>
                  </div>

                  <div className={styles.capacityRow}>
                    <span className={styles.capacityLabel}>Battery capacity</span>
                    <span
                      className={`${styles.capacityValue} ${vehicle.batteryCapacityKwh == null ? styles.capacityValueUnset : ""}`}
                    >
                      {formatCapacity(vehicle.batteryCapacityKwh)}
                    </span>
                  </div>

                  {editingId === vehicle.id && (
                    <CapacityEditForm
                      vehicle={vehicle}
                      onCancel={() => setEditingId(null)}
                      onSave={(batteryCapacityKwh) => saveCapacity(vehicle.id, batteryCapacityKwh)}
                    />
                  )}
                </div>
              ))
            )}

            <h2 className={styles.sectiontitle}>Add a vehicle</h2>
            {adding ? (
              <AddVehicleForm onCancel={() => setAdding(false)} onCreate={createVehicle} />
            ) : (
              <button type="button" className={styles.addToggle} onClick={() => setAdding(true)}>
                + Add vehicle
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
