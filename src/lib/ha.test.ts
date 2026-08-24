import { afterEach, describe, expect, it, vi } from "vitest";

function haResponse(state: string, attributes: Record<string, unknown> = {}) {
  return { ok: true, json: async () => ({ state, attributes }) };
}

describe("fetchVehicleSnapshot", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("polls the confirmed electra entity ids and parses their values", async () => {
    vi.stubEnv("HA_BASE_URL", "https://ha.example.com");
    vi.stubEnv("HA_LONG_LIVED_TOKEN", "test-token");

    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("sensor.electra_battery")) return haResponse("77");
      if (url.endsWith("binary_sensor.electra_charging")) return haResponse("on");
      if (url.endsWith("sensor.electra_energy_added")) return haResponse("12.5");
      if (url.endsWith("binary_sensor.electra_charger")) {
        return haResponse("off", { charging_state: "Disconnected" });
      }
      if (url.endsWith("sensor.electra_odometer")) return haResponse("15230");
      if (url.endsWith("sensor.electra_shift_state")) return haResponse("D");
      if (url.endsWith("device_tracker.electra_location_tracker")) {
        return haResponse("home", { latitude: 44.5, longitude: 11.3 });
      }
      if (url.endsWith("sensor.electra_charger_power")) return haResponse("0");
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchVehicleSnapshot } = await import("./ha");
    const snapshot = await fetchVehicleSnapshot("electra");

    expect(snapshot).toEqual({
      batteryLevel: 77,
      charging: true,
      pluggedIn: false,
      chargingState: "Disconnected",
      energyAdded: 12.5,
      odometer: 15230,
      shiftState: "D",
      chargerPower: 0,
      latitude: 44.5,
      longitude: 11.3,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ha.example.com/api/states/sensor.electra_battery",
      { headers: { Authorization: "Bearer test-token" } },
    );
  });

  it("throws when HA credentials are missing", async () => {
    vi.stubEnv("HA_BASE_URL", "");
    vi.stubEnv("HA_LONG_LIVED_TOKEN", "");

    const { fetchVehicleSnapshot } = await import("./ha");

    await expect(fetchVehicleSnapshot("electra")).rejects.toThrow(/Missing required env var/);
  });

  it("throws when the charger's charging_state attribute is missing", async () => {
    vi.stubEnv("HA_BASE_URL", "https://ha.example.com");
    vi.stubEnv("HA_LONG_LIVED_TOKEN", "test-token");

    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("sensor.electra_battery")) return haResponse("77");
      if (url.endsWith("binary_sensor.electra_charging")) return haResponse("on");
      if (url.endsWith("sensor.electra_energy_added")) return haResponse("12.5");
      if (url.endsWith("binary_sensor.electra_charger")) return haResponse("off"); // no charging_state attribute
      if (url.endsWith("sensor.electra_odometer")) return haResponse("15230");
      if (url.endsWith("sensor.electra_shift_state")) return haResponse("D");
      if (url.endsWith("device_tracker.electra_location_tracker")) {
        return haResponse("home", { latitude: 44.5, longitude: 11.3 });
      }
      if (url.endsWith("sensor.electra_charger_power")) return haResponse("0");
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchVehicleSnapshot } = await import("./ha");

    await expect(fetchVehicleSnapshot("electra")).rejects.toThrow(/missing charging_state/);
  });

  it("throws when HA responds with a non-ok status", async () => {
    vi.stubEnv("HA_BASE_URL", "https://ha.example.com");
    vi.stubEnv("HA_LONG_LIVED_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 502 })));

    const { fetchVehicleSnapshot } = await import("./ha");

    await expect(fetchVehicleSnapshot("electra")).rejects.toThrow(/HA request failed/);
  });
});

describe("findMissedDrive", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function historyResponse(points: { state: string; last_changed: string; attributes?: Record<string, unknown> }[]) {
    return { ok: true, json: async () => [points] };
  }

  it("returns null when shift_state history has no closed D span", async () => {
    vi.stubEnv("HA_BASE_URL", "https://ha.example.com");
    vi.stubEnv("HA_LONG_LIVED_TOKEN", "test-token");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("shift_state")) {
        return historyResponse([{ state: "P", last_changed: "2026-08-24T09:59:00Z" }]);
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { findMissedDrive } = await import("./ha");
    const result = await findMissedDrive("electra", new Date("2026-08-24T09:55:00Z"));

    expect(result).toBeNull();
  });

  it("reconstructs the bounding readings for a D span that opened and closed within the window", async () => {
    vi.stubEnv("HA_BASE_URL", "https://ha.example.com");
    vi.stubEnv("HA_LONG_LIVED_TOKEN", "test-token");

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("shift_state")) {
        return historyResponse([
          { state: "P", last_changed: "2026-08-24T09:59:00Z" },
          { state: "D", last_changed: "2026-08-24T10:00:00Z" },
          { state: "P", last_changed: "2026-08-24T10:03:00Z" },
        ]);
      }
      if (url.includes("_battery")) {
        return historyResponse([
          { state: "80", last_changed: "2026-08-24T09:59:00Z" },
          { state: "79", last_changed: "2026-08-24T10:02:00Z" },
        ]);
      }
      if (url.includes("_charging")) return historyResponse([{ state: "off", last_changed: "2026-08-24T09:59:00Z" }]);
      if (url.includes("_energy_added")) return historyResponse([{ state: "0", last_changed: "2026-08-24T09:59:00Z" }]);
      if (url.includes("_charger_power")) return historyResponse([{ state: "0", last_changed: "2026-08-24T09:59:00Z" }]);
      if (url.includes("_charger")) {
        return historyResponse([
          { state: "off", last_changed: "2026-08-24T09:59:00Z", attributes: { charging_state: "Disconnected" } },
        ]);
      }
      if (url.includes("_odometer")) {
        return historyResponse([
          { state: "15230", last_changed: "2026-08-24T09:59:00Z" },
          { state: "15235", last_changed: "2026-08-24T10:03:00Z" },
        ]);
      }
      if (url.includes("location_tracker")) {
        return historyResponse([
          { state: "home", last_changed: "2026-08-24T09:59:00Z", attributes: { latitude: 44.5, longitude: 11.3 } },
          { state: "not_home", last_changed: "2026-08-24T10:03:00Z", attributes: { latitude: 44.6, longitude: 11.4 } },
        ]);
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { findMissedDrive } = await import("./ha");
    const result = await findMissedDrive("electra", new Date("2026-08-24T09:55:00Z"));

    expect(result).not.toBeNull();
    expect(result!.start.at).toEqual(new Date("2026-08-24T10:00:00Z"));
    expect(result!.end.at).toEqual(new Date("2026-08-24T10:03:00Z"));
    expect(result!.start.snapshot).toMatchObject({ shiftState: "D", odometer: 15230, latitude: 44.5 });
    expect(result!.end.snapshot).toMatchObject({ shiftState: "D", odometer: 15235, latitude: 44.6 });
  });
});
