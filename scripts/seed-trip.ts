// Seeds one fully-fledged fake Trip (drive leg -> charge stop -> drive leg
// -> stop) directly into Mongo, bypassing HA entirely, so every derived
// feature (map route/pins, battery chart, Wh/km, stats, place-name/cost
// editing) can be exercised while the real car is parked. Writes through the
// same domain/model code the live app uses (syncTripDerivedData, the model
// layer) rather than duplicating that logic here.
//
// Run with `npm run seed:trip` (loads .env.local via tsx's --env-file flag —
// not process.loadEnvFile() here, since that would run after these static
// imports' top-level code under ESM's import-hoisting semantics, too late
// for db.ts's module-scope `process.env.MONGODB_DB` read below).
//
// Writes to the SAME MongoDB the deployed app uses (no separate dev DB for
// this project) — seeds under a dedicated "Test Vehicle" so it never mixes
// into the real vehicle's All-time Stats, and prints the trip id so you can
// delete it from the Trips list when done.

import { ObjectId } from "mongodb";
import { getDb } from "../src/lib/db";
import getMongoClient from "../src/lib/mongodb";
import { listVehicles, createVehicle } from "../src/lib/models/vehicle";
import { listChargeSessionsByTrip, updateChargeSession } from "../src/lib/models/charge-session";
import { syncTripDerivedData } from "../src/lib/domain/sync-trip-derived-data";

const TEST_VEHICLE_NAME = "Test Vehicle";
const TEST_VEHICLE_ENTITY_PREFIX = "test_vehicle";
const POLL_INTERVAL_MS = 5 * 60_000;

// A real route (Bologna -> a halfway charge stop -> Modena) so Mapbox
// reverse-geocoding returns real place names instead of "Unnamed Road" —
// see CONTEXT.md/the existing test fixtures, which already use this corridor.
const START = { lat: 44.4949, lon: 11.3426 }; // Bologna
const MID = { lat: 44.571, lon: 11.1339 }; // charge stop, roughly halfway
const END = { lat: 44.6471, lon: 10.9252 }; // Modena

interface FakeSnapshot {
  shiftState: string;
  chargingState: string;
  charging: boolean;
  pluggedIn: boolean;
  odometer: number;
  batteryLevel: number;
  energyAdded: number;
  chargerPower: number;
  lat: number;
  lon: number;
}

// 5-minute cadence, matching the real poll resolution (see CONTEXT.md's
// "Segment inference rules"): drive leg 1 (2 samples) -> park + charge
// (2 non-driving samples close the DriveSegment; Charging -> Complete closes
// the ChargeSession) -> drive leg 2 (2 samples) -> park (2 non-driving
// samples close the second DriveSegment) -> trip stopped.
const SNAPSHOTS: FakeSnapshot[] = [
  { shiftState: "D", chargingState: "Disconnected", charging: false, pluggedIn: false, odometer: 1000, batteryLevel: 80, energyAdded: 0, chargerPower: 0, ...START },
  { shiftState: "D", chargingState: "Disconnected", charging: false, pluggedIn: false, odometer: 1020, batteryLevel: 74, energyAdded: 0, chargerPower: 0, ...MID },
  { shiftState: "P", chargingState: "Disconnected", charging: false, pluggedIn: false, odometer: 1020, batteryLevel: 74, energyAdded: 0, chargerPower: 0, ...MID },
  { shiftState: "P", chargingState: "Charging", charging: true, pluggedIn: true, odometer: 1020, batteryLevel: 76, energyAdded: 2, chargerPower: 50, ...MID },
  { shiftState: "P", chargingState: "Charging", charging: true, pluggedIn: true, odometer: 1020, batteryLevel: 85, energyAdded: 15, chargerPower: 50, ...MID },
  { shiftState: "P", chargingState: "Complete", charging: false, pluggedIn: true, odometer: 1020, batteryLevel: 95, energyAdded: 30, chargerPower: 0, ...MID },
  { shiftState: "D", chargingState: "Complete", charging: false, pluggedIn: false, odometer: 1020, batteryLevel: 95, energyAdded: 30, chargerPower: 0, ...MID },
  { shiftState: "D", chargingState: "Disconnected", charging: false, pluggedIn: false, odometer: 1042, batteryLevel: 88, energyAdded: 0, chargerPower: 0, ...END },
  { shiftState: "P", chargingState: "Disconnected", charging: false, pluggedIn: false, odometer: 1042, batteryLevel: 88, energyAdded: 0, chargerPower: 0, ...END },
  { shiftState: "P", chargingState: "Disconnected", charging: false, pluggedIn: false, odometer: 1042, batteryLevel: 87, energyAdded: 0, chargerPower: 0, ...END },
];

async function findOrCreateTestVehicle() {
  const existing = (await listVehicles()).find((v) => v.entityPrefix === TEST_VEHICLE_ENTITY_PREFIX);
  if (existing) return existing;
  return createVehicle({
    name: TEST_VEHICLE_NAME,
    entityPrefix: TEST_VEHICLE_ENTITY_PREFIX,
    batteryCapacityKwh: 75,
  });
}

async function main() {
  const vehicle = await findOrCreateTestVehicle();
  const vehicleId = new ObjectId(vehicle.id);
  const tripId = new ObjectId();

  // Whole trip ends 15 minutes ago and started 60 minutes ago — recent
  // enough to feel like "the trip you just finished," not backdated to some
  // arbitrary point in history.
  const tripStart = new Date(Date.now() - 60 * 60_000);
  const polledAts = SNAPSHOTS.map((_, i) => new Date(tripStart.getTime() + i * POLL_INTERVAL_MS));
  const tripEnd = new Date(polledAts[polledAts.length - 1].getTime() + 60_000);

  const db = await getDb();

  // startTrip()/stopTrip() always stamp "now" — bypassed here (direct insert)
  // so the seeded trip can carry realistic historical timestamps instead.
  await db.collection("trips").insertOne({
    _id: tripId,
    vehicleId,
    startedAt: tripStart,
    endedAt: tripEnd,
  });

  await db.collection("pollSnapshots").insertMany(
    SNAPSHOTS.map((snapshot, i) => ({
      _id: new ObjectId(),
      tripId,
      vehicleId,
      polledAt: polledAts[i],
      batteryLevel: snapshot.batteryLevel,
      shiftState: snapshot.shiftState,
      charging: snapshot.charging,
      pluggedIn: snapshot.pluggedIn,
      chargingState: snapshot.chargingState,
      energyAdded: snapshot.energyAdded,
      odometer: snapshot.odometer,
      chargerPower: snapshot.chargerPower,
      latitude: snapshot.lat,
      longitude: snapshot.lon,
    })),
  );

  // Same derive+geocode path the real poll trigger uses — builds
  // DriveSegments, ChargeSessions and the RouteLog from the snapshots above.
  await syncTripDerivedData(tripId.toHexString(), vehicle.id);

  // syncTripDerivedData leaves a freshly-derived ChargeSession's cost fields
  // null/free:false (they're user-entered, not derived) — set a plausible
  // public-charger tariff here so the trip totals/edit UI have something
  // real to look at instead of "€0.00".
  const chargeSessions = await listChargeSessionsByTrip(tripId.toHexString());
  for (const session of chargeSessions) {
    await updateChargeSession(session.id, { costPerKwh: 0.42, free: false });
  }

  console.log(`Seeded trip ${tripId.toHexString()} for vehicle "${vehicle.name}" (${vehicle.id}).`);
  console.log(`Open it at /trips/${tripId.toHexString()} (npm run dev, then log in).`);
  console.log("Delete it from the Trips list (🗑) when you're done testing.");

  const client = await getMongoClient();
  await client.close();
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
  // The MongoClient's connection keeps the event loop alive on its own, so
  // an uncaught rejection here would otherwise hang the process instead of
  // exiting with the error already printed above.
  try {
    const client = await getMongoClient();
    await client.close();
  } catch {
    // best-effort — we're already exiting non-zero
  }
});
