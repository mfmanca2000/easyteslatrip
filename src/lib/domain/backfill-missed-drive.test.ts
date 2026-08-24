import { beforeEach, describe, expect, it, vi } from "vitest";

const createPollSnapshot = vi.fn();
const pollTripOnce = vi.fn();

vi.mock("@/lib/models/poll-snapshot", () => ({
  createPollSnapshot: (...args: unknown[]) => createPollSnapshot(...args),
}));
vi.mock("@/lib/domain/poll-trip", () => ({
  pollTripOnce: (...args: unknown[]) => pollTripOnce(...args),
}));

const TRIP_ID = "507f1f77bcf86cd799439099";
const VEHICLE_ID = "507f1f77bcf86cd799439011";

describe("backfillMissedDrive", () => {
  beforeEach(() => {
    createPollSnapshot.mockReset().mockResolvedValue(undefined);
    pollTripOnce.mockReset().mockResolvedValue(undefined);
  });

  it("writes the two backfilled snapshots at their historical timestamps, then polls live", async () => {
    const missedDrive = {
      start: { at: new Date("2026-08-24T10:00:00Z"), snapshot: { odometer: 15230, shiftState: "D" } },
      end: { at: new Date("2026-08-24T10:03:00Z"), snapshot: { odometer: 15235, shiftState: "D" } },
    };

    const { backfillMissedDrive } = await import("./backfill-missed-drive");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await backfillMissedDrive(TRIP_ID, VEHICLE_ID, missedDrive as any);

    expect(createPollSnapshot).toHaveBeenNthCalledWith(1, {
      tripId: TRIP_ID,
      vehicleId: VEHICLE_ID,
      polledAt: missedDrive.start.at,
      odometer: 15230,
      shiftState: "D",
    });
    expect(createPollSnapshot).toHaveBeenNthCalledWith(2, {
      tripId: TRIP_ID,
      vehicleId: VEHICLE_ID,
      polledAt: missedDrive.end.at,
      odometer: 15235,
      shiftState: "D",
    });
    expect(pollTripOnce).toHaveBeenCalledWith(TRIP_ID, VEHICLE_ID);
    expect(createPollSnapshot.mock.invocationCallOrder[0]).toBeLessThan(pollTripOnce.mock.invocationCallOrder[0]);
  });
});
