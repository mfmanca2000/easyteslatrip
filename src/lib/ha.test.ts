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
      if (url.endsWith("binary_sensor.electra_charger")) return haResponse("off");
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

  it("throws when HA responds with a non-ok status", async () => {
    vi.stubEnv("HA_BASE_URL", "https://ha.example.com");
    vi.stubEnv("HA_LONG_LIVED_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 502 })));

    const { fetchVehicleSnapshot } = await import("./ha");

    await expect(fetchVehicleSnapshot("electra")).rejects.toThrow(/HA request failed/);
  });
});
