export interface VehicleSnapshot {
  batteryLevel: number;
  shiftState: string;
  charging: boolean;
  pluggedIn: boolean;
  chargingState: string;
  energyAdded: number;
  odometer: number;
  chargerPower: number;
  latitude: number;
  longitude: number;
}

interface HaState {
  state: string;
  attributes: Record<string, unknown>;
}

async function fetchState(entityId: string): Promise<HaState> {
  const baseUrl = process.env.HA_BASE_URL;
  const token = process.env.HA_LONG_LIVED_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("Missing required env var: HA_BASE_URL or HA_LONG_LIVED_TOKEN");
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/states/${entityId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`HA request failed for ${entityId}: ${response.status}`);
  }

  const body: HaState = await response.json();
  if (body.state === "unavailable" || body.state === "unknown") {
    // A transient Nabu Casa/HA gap would otherwise coerce straight to NaN
    // (or the literal string) and write silently into the PollSnapshot
    // audit trail instead of failing the poll.
    throw new Error(`HA entity ${entityId} is ${body.state}`);
  }
  return body;
}

// Entity naming follows `<domain>.<vehicle_name>_<field>` (see CONTEXT.md) —
// confirmed against the alandtse/tesla HACS integration for `electra`.
export async function fetchVehicleSnapshot(entityPrefix: string): Promise<VehicleSnapshot> {
  const [battery, charging, energyAdded, charger, odometer, shiftState, locationTracker, chargerPower] =
    await Promise.all([
      fetchState(`sensor.${entityPrefix}_battery`),
      fetchState(`binary_sensor.${entityPrefix}_charging`),
      fetchState(`sensor.${entityPrefix}_energy_added`),
      fetchState(`binary_sensor.${entityPrefix}_charger`),
      fetchState(`sensor.${entityPrefix}_odometer`),
      fetchState(`sensor.${entityPrefix}_shift_state`),
      fetchState(`device_tracker.${entityPrefix}_location_tracker`),
      fetchState(`sensor.${entityPrefix}_charger_power`),
    ]);

  // Not its own entity — the alandtse/tesla integration surfaces the raw
  // Tesla charging_state (Charging/Complete/Disconnected/...) as an
  // attribute on binary_sensor.<car>_charger rather than a sensor of its
  // own, so it rides along with the existing "charger" fetch.
  const chargingState = charger.attributes.charging_state;
  if (typeof chargingState !== "string") {
    // Guards the same silent-bad-write failure mode as the unavailable/
    // unknown check in fetchState — a missing attribute would otherwise
    // coerce to the literal string "undefined" and never match a known
    // charging_state value again for the rest of the trip.
    throw new Error(`HA entity binary_sensor.${entityPrefix}_charger is missing charging_state`);
  }

  return {
    batteryLevel: Number(battery.state),
    charging: charging.state === "on",
    energyAdded: Number(energyAdded.state),
    pluggedIn: charger.state === "on",
    chargingState,
    odometer: Number(odometer.state),
    shiftState: shiftState.state,
    chargerPower: Number(chargerPower.state),
    latitude: Number(locationTracker.attributes.latitude),
    longitude: Number(locationTracker.attributes.longitude),
  };
}

interface HaHistoryPoint {
  state: string;
  last_changed: string;
  attributes: Record<string, unknown>;
}

// HA's history endpoint nests one array per requested entity even for a
// single filter_entity_id — https://developers.home-assistant.io/docs/api/rest/.
async function fetchHistorySince(entityId: string, since: Date): Promise<HaHistoryPoint[]> {
  const baseUrl = process.env.HA_BASE_URL;
  const token = process.env.HA_LONG_LIVED_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("Missing required env var: HA_BASE_URL or HA_LONG_LIVED_TOKEN");
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/api/history/period/${since.toISOString()}?filter_entity_id=${entityId}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!response.ok) {
    throw new Error(`HA history request failed for ${entityId}: ${response.status}`);
  }

  const body: HaHistoryPoint[][] = await response.json();
  return body[0] ?? [];
}

// Most recent point at-or-before `at`, falling back to the series' first
// point if the whole series starts after `at` (HA's history endpoint
// includes the state active at the start of the requested window as the
// first entry, but this guards the edge case if it doesn't).
function stateAt(series: HaHistoryPoint[], at: Date): HaHistoryPoint | undefined {
  let candidate: HaHistoryPoint | undefined;
  for (const point of series) {
    if (new Date(point.last_changed) > at) break;
    candidate = point;
  }
  return candidate ?? series[0];
}

export interface MissedDrive {
  start: { at: Date; snapshot: VehicleSnapshot };
  end: { at: Date; snapshot: VehicleSnapshot };
}

// A poll only ever sees the vehicle's *current* HA state, so a drive
// shorter than the gap between polls (UptimeRobot's ~5-minute baseline) can
// enter and leave shift_state "D" between two samples without either one
// observing "D" — silently losing the whole drive. Called only when the
// live snapshot just came back non-D; scans HA's history for a D span that
// opened and closed entirely inside the lookback window and, if found,
// returns two PollSnapshot-shaped readings bounding it so the normal
// DriveSegment state machine (see derive-segments.ts) can still pick it up.
// Both are tagged shiftState "D" — including the one at the moment driving
// actually stopped — because that state machine defines a segment's end as
// its *last confirmed-driving* sample, not the first non-driving one; the
// real return-to-P gets recorded separately by the live poll that follows.
// Returns null if no closed D span is found (nothing missed, or the
// vehicle is still mid-drive and will be caught by the live check next
// cycle instead).
export async function findMissedDrive(entityPrefix: string, since: Date): Promise<MissedDrive | null> {
  const shiftSeries = await fetchHistorySince(`sensor.${entityPrefix}_shift_state`, since);

  let driveStart: Date | null = null;
  let window: { start: Date; end: Date } | null = null;
  for (const point of shiftSeries) {
    const at = new Date(point.last_changed);
    if (point.state === "D" && driveStart === null) {
      driveStart = at;
    } else if (point.state !== "D" && driveStart !== null) {
      window = { start: driveStart, end: at };
      driveStart = null;
    }
  }
  if (!window) return null;

  const [battery, charging, energyAdded, charger, odometer, locationTracker, chargerPower] = await Promise.all([
    fetchHistorySince(`sensor.${entityPrefix}_battery`, since),
    fetchHistorySince(`binary_sensor.${entityPrefix}_charging`, since),
    fetchHistorySince(`sensor.${entityPrefix}_energy_added`, since),
    fetchHistorySince(`binary_sensor.${entityPrefix}_charger`, since),
    fetchHistorySince(`sensor.${entityPrefix}_odometer`, since),
    fetchHistorySince(`device_tracker.${entityPrefix}_location_tracker`, since),
    fetchHistorySince(`sensor.${entityPrefix}_charger_power`, since),
  ]);

  if (stateAt(odometer, window.start) === undefined || stateAt(locationTracker, window.start) === undefined) {
    // Odometer/location are load-bearing for DriveSegment distance and
    // route — without them a backfilled segment would be meaningless, so
    // fail loudly (caught and logged by the caller) rather than write junk.
    throw new Error(`HA history missing odometer/location for ${entityPrefix} around ${window.start.toISOString()}`);
  }

  function snapshotAt(at: Date): VehicleSnapshot {
    const chargerPoint = stateAt(charger, at);
    const chargingState = chargerPoint?.attributes.charging_state;
    const locationPoint = stateAt(locationTracker, at)!;
    return {
      batteryLevel: Number(stateAt(battery, at)?.state),
      charging: stateAt(charging, at)?.state === "on",
      pluggedIn: chargerPoint?.state === "on",
      chargingState: typeof chargingState === "string" ? chargingState : "Disconnected",
      energyAdded: Number(stateAt(energyAdded, at)?.state ?? 0),
      odometer: Number(stateAt(odometer, at)!.state),
      shiftState: "D",
      chargerPower: Number(stateAt(chargerPower, at)?.state ?? 0),
      latitude: Number(locationPoint.attributes.latitude),
      longitude: Number(locationPoint.attributes.longitude),
    };
  }

  return {
    start: { at: window.start, snapshot: snapshotAt(window.start) },
    end: { at: window.end, snapshot: snapshotAt(window.end) },
  };
}
