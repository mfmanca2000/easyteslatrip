Type: task
Status: resolved

## Question

Discover and document the exact Home Assistant entity ids exposed for the Tesla vehicle(s) in the user's actual HA instance, so PollSnapshot field-mapping is built against real entities rather than assumed ones from CONTEXT.md.

Checklist for the user (HITL — needs the user's own HA instance):
- In HA, go to Developer Tools → States, filter by the Tesla device/vehicle name.
- Record the entity ids and current example values for: battery level, battery/rated range, charging state, charger power, charge energy added, plugged-in/charger connected, odometer, shift/gear state, device_tracker (GPS + zone).
- Note which integration is installed (community `tesla_custom` vs Tesla's official Fleet API integration) — entity ids and available attributes differ between them.
- Confirm the Nabu Casa remote URL/token path this app will use to reach HA's API (long-lived access token vs Nabu Casa cloud API).
- If multiple vehicles exist, repeat for each.

## Answer

Integration confirmed: [`alandtse/tesla`](https://github.com/alandtse/tesla) (community `tesla_custom` via HACS). One vehicle, named `electra`. Confirmed entity ids:

- `sensor.electra_battery`
- `binary_sensor.electra_charging`
- `sensor.electra_energy_added`
- `binary_sensor.electra_charger`
- `sensor.electra_odometer`
- `sensor.electra_shift_state`
- `device_tracker.electra_location_tracker`
- `sensor.electra_charger_power`

Auth: user will create an HA Long-Lived Access Token (Profile → Security), used over the Nabu Casa remote URL. Full detail and glossary update in [CONTEXT.md](../../../CONTEXT.md).

Naming pattern `<domain>.<vehicle_name>_<field>` confirmed — repeats per vehicle if a second car is added later.
