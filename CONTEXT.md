# Context: EasyTeslaTrip

Glossary for the Tesla road-trip tracker. Data source of truth is Home Assistant (HA), polled remotely via Nabu Casa. HA integration confirmed: [`alandtse/tesla`](https://github.com/alandtse/tesla) (community `tesla_custom`, installed via HACS). One vehicle registered so far, named `electra`. Confirmed entity ids (Developer Tools → States, 2026-08-20):

- `sensor.electra_battery` — battery level (%)
- `binary_sensor.electra_charging` — charging yes/no
- `sensor.electra_energy_added` — energy added this session (kWh)
- `binary_sensor.electra_charger` — plugged in yes/no
- `sensor.electra_odometer` — cumulative odometer (km)
- `sensor.electra_shift_state` — `P` / `D` / `R` / `N` (drive state)
- `device_tracker.electra_location_tracker` — GPS lat/long + zone
- `sensor.electra_charger_power` — instantaneous charge power (kW)

Entity naming follows the pattern `<domain>.<vehicle_name>_<field>` — a second vehicle would repeat this pattern under its own name.

Nothing pushes events — the app must **poll** HA state on an interval and infer segments from consecutive snapshots (a state-machine over `shift_state` + `charging` + `charger`).

## Terms

**Vehicle**
A single physical Tesla, identified by its HA device/entity prefix. A user may register multiple Vehicles (multi-car support). All Trips belong to exactly one Vehicle.

**Trip**
A user-declared span of travel for one Vehicle, manually started and manually stopped in the web app (not inferred from car state). A Trip is the top-level container: it owns DriveSegments, ChargeSessions, and the RouteLog for the time window between its start and stop. A Vehicle may have many Trips; Trips do not overlap for the same Vehicle.

**PollSnapshot**
One raw poll of a Vehicle's HA state at a point in time (battery %, shift_state, charging_state, odometer, lat/long, charger_power). The atomic unit ingested from HA; DriveSegments, ChargeSessions, and RouteLog points are all derived from consecutive PollSnapshots. Retained as the audit trail / reprocessing source.

**DriveSegment**
A contiguous period within a Trip where the Vehicle is inferred to be driving (derived from `shift_state` != `P` and/or odometer increasing between snapshots). Fields: start/end time, start/end odometer, distance, duration, start/end GPS point, start/end place name (reverse-geocoded via Mapbox at write-time when the segment closes, user-editable).

**ChargeSession**
A contiguous period within a Trip where the Vehicle is inferred to be charging (`charging_state == Charging`). Fields: location (GPS + place name, reverse-geocoded via Mapbox at write-time when the session closes, user-editable), start/end time, duration, start/end battery %, energy added (kWh), cost — either a manual `€/kWh` or total `€` entered by the user, or a `free: true` flag (superchargers today are free for this user, but cost fields stay first-class for when that changes).

**RouteLog**
The ordered sequence of GPS points (from PollSnapshots) for a Trip, used to draw the path on the map. Distinct from DriveSegment (which is a time/distance summary) — RouteLog is the raw breadcrumb trail.

## Segment inference rules

Poll resolution is fixed at 5 minutes (see the polling design). Rules are expressed in consecutive samples, not raw minutes:

- **DriveSegment** ends after 2 consecutive non-driving samples (`shift_state != D`, ~10 min). A single lone non-driving sample is treated as noise (e.g. one red light) and does not split the segment.
- **ChargeSession** ends at `charging_state == Complete` — not at unplug. The idle plugged-in time after Complete is not part of the session.
- **RouteLog** always straight-line interpolates between consecutive GPS points, regardless of the time/distance gap between them — no special handling for missed polls.

## Open questions (not yet resolved)

(none remaining)
