// One-off correction for the auto-stop-while-charging bug (see
// src/lib/domain/poll-trip.ts): a trip that was still charging got
// auto-stopped, force-closing its trailing ChargeSession/DriveSegment and
// corrupting stats. This reopens the most recent trip (endedAt -> null) and
// re-derives its DriveSegments/ChargeSessions/RouteLog from the existing
// PollSnapshot history *without* force-closing the trailing data, so a
// still-charging session reappears open. The next regular poll (once the
// trip is active again) will then pick up fresh HA samples as usual.
//
// Run with `npx tsx --env-file=.env.local scripts/reopen-last-trip.ts`.
// Pass a trip id to target a specific trip instead of the most recent one:
// `npx tsx --env-file=.env.local scripts/reopen-last-trip.ts <tripId>`.
// Add `--yes` to skip the confirmation prompt (e.g. for non-interactive use).

import { ObjectId } from "mongodb";
import { getDb } from "../src/lib/db";
import getMongoClient from "../src/lib/mongodb";
import { getVehicleById } from "../src/lib/models/vehicle";
import { listPollSnapshotsByTrip } from "../src/lib/models/poll-snapshot";
import { syncTripDerivedData } from "../src/lib/domain/sync-trip-derived-data";

async function main() {
  const args = process.argv.slice(2);
  const skipConfirm = args.includes("--yes");
  const tripIdArg = args.find((a) => !a.startsWith("--"));

  const db = await getDb();
  const tripDoc = tripIdArg
    ? await db.collection("trips").findOne({ _id: new ObjectId(tripIdArg) })
    : (await db.collection("trips").find({}).sort({ startedAt: -1 }).limit(1).toArray())[0];

  if (!tripDoc) {
    console.error(tripIdArg ? `No trip found with id ${tripIdArg}.` : "No trips found.");
    process.exitCode = 1;
    return;
  }

  const tripId = tripDoc._id.toHexString();
  const vehicleId = tripDoc.vehicleId.toHexString();
  const vehicle = await getVehicleById(vehicleId);

  if (tripDoc.endedAt === null) {
    console.log(`Trip ${tripId} is already open (endedAt is null). Nothing to do.`);
    return;
  }

  const snapshots = await listPollSnapshotsByTrip(tripId);
  const last = snapshots[snapshots.length - 1];

  console.log("=== Trip to reopen ===");
  console.log({
    id: tripId,
    vehicle: vehicle?.name,
    startedAt: tripDoc.startedAt,
    endedAt: tripDoc.endedAt,
  });
  console.log("\n=== Last known poll snapshot ===");
  console.log(
    last
      ? {
          polledAt: last.polledAt,
          shiftState: last.shiftState,
          charging: last.charging,
          pluggedIn: last.pluggedIn,
          chargingState: last.chargingState,
        }
      : "(no snapshots on this trip)",
  );

  if (last && !last.charging) {
    console.warn(
      "\nWarning: the last recorded snapshot does NOT show charging=true. " +
        "Reopening anyway, but double-check this is the right trip.",
    );
  }

  const activeTrip = await db.collection("trips").findOne({ vehicleId: tripDoc.vehicleId, endedAt: null });
  if (activeTrip) {
    console.error(
      `\nVehicle ${vehicle?.name ?? vehicleId} already has an active trip (${activeTrip._id.toHexString()}). ` +
        "Refusing to reopen a second one.",
    );
    process.exitCode = 1;
    return;
  }

  if (!skipConfirm) {
    console.log("\nRe-run with --yes to actually reopen this trip. No changes made.");
    return;
  }

  await db.collection("trips").updateOne({ _id: tripDoc._id }, { $set: { endedAt: null } });
  console.log(`\nReopened trip ${tripId} (endedAt set to null).`);

  // Re-derive without tripEnded so a trailing open ChargeSession/DriveSegment
  // (force-closed by the earlier bad auto-stop) reappears open instead of
  // staying artificially closed.
  await syncTripDerivedData(tripId, vehicleId);
  console.log("Re-synced DriveSegments/ChargeSessions/RouteLog from existing PollSnapshot history.");
  console.log("The next regular poll will resume picking up fresh HA samples for this trip.");

  const client = await getMongoClient();
  await client.close();
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
  try {
    const client = await getMongoClient();
    await client.close();
  } catch {
    // best-effort — we're already exiting non-zero
  }
});
