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

describe("backfillOngoingDriveStart", () => {
  beforeEach(() => {
    createPollSnapshot.mockReset().mockResolvedValue(undefined);
    pollTripOnce.mockReset().mockResolvedValue(undefined);
  });

  it("writes the backfilled start snapshot at its historical timestamp, then polls live", async () => {
    const ongoingStart = {
      at: new Date("2026-08-24T10:00:00Z"),
      snapshot: { odometer: 15230, shiftState: "D" },
    };

    const { backfillOngoingDriveStart } = await import("./backfill-ongoing-drive-start");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await backfillOngoingDriveStart(TRIP_ID, VEHICLE_ID, ongoingStart as any);

    expect(createPollSnapshot).toHaveBeenCalledWith({
      tripId: TRIP_ID,
      vehicleId: VEHICLE_ID,
      polledAt: ongoingStart.at,
      odometer: 15230,
      shiftState: "D",
    });
    expect(pollTripOnce).toHaveBeenCalledWith(TRIP_ID, VEHICLE_ID);
    expect(createPollSnapshot.mock.invocationCallOrder[0]).toBeLessThan(pollTripOnce.mock.invocationCallOrder[0]);
  });
});
