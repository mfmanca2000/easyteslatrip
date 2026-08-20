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
