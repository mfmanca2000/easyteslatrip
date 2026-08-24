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
A single physical Tesla, identified by its HA device/entity prefix. A user may register multiple Vehicles (multi-car support). All Trips belong to exactly one Vehicle. Carries a user-entered usable battery pack capacity (`batteryCapacityKwh`, nullable) — HA exposes no energy-consumed sensor, so this is what turns a DriveSegment's battery % drop into a Wh/km figure.

**Trip**
A span of travel for one Vehicle, manually stopped in the web app, and either manually started there or auto-started by the poll trigger when it finds a Vehicle with no active trip sitting in `shift_state == D` (a single sample is enough — see Segment inference rules). A Trip is the top-level container: it owns DriveSegments, ChargeSessions, and the RouteLog for the time window between its start and stop. A Vehicle may have many Trips; Trips do not overlap for the same Vehicle.

**PollSnapshot**
One raw poll of a Vehicle's HA state at a point in time (battery %, shift_state, charging_state, odometer, lat/long, charger_power). The atomic unit ingested from HA; DriveSegments, ChargeSessions, and RouteLog points are all derived from consecutive PollSnapshots. Retained as the audit trail / reprocessing source. Usually timestamped at fetch time, but a missed-drive backfill (see Segment inference rules) writes two with a historical `polledAt` pulled from HA's history API instead.

**DriveSegment**
A contiguous period within a Trip where the Vehicle is inferred to be driving (derived from `shift_state` != `P` and/or odometer increasing between snapshots). Fields: start/end time, start/end odometer, distance, duration, start/end battery %, start/end GPS point, start/end place name (reverse-geocoded via Mapbox at write-time when the segment closes, user-editable).

**Consumption (Wh/km)**
Energy used per km driven, inferred from a DriveSegment's battery % drop times the Vehicle's `batteryCapacityKwh` — never null-guarded away to zero, since a segment with net regen legitimately yields a negative figure. Null wherever the Vehicle has no configured battery capacity, or there's no closed drive distance to divide by. Reported at three levels: per DriveSegment (leg), summed across a Trip's DriveSegments (trip total), and summed across every Trip's DriveSegments for a Vehicle (all-time). Each aggregate sums energy used over distance driven rather than averaging per-leg ratios, so longer legs weigh proportionally more.

**ChargeSession**
A contiguous period within a Trip where the Vehicle is inferred to be charging (`charging_state == Charging`). Fields: location (GPS + place name, reverse-geocoded via Mapbox at write-time when the session closes, user-editable), start/end time, duration, start/end battery %, energy added (kWh), cost — either a manual `€/kWh` or total `€` entered by the user, or a `free: true` flag (superchargers today are free for this user, but cost fields stay first-class for when that changes).

**RouteLog**
The ordered sequence of GPS points (from PollSnapshots) for a Trip, used to draw the path on the map. Distinct from DriveSegment (which is a time/distance summary) — RouteLog is the raw breadcrumb trail.

## Segment inference rules

Poll cadence is not uniform: an external UptimeRobot monitor triggers a poll every ~5 minutes as a baseline, but the app also triggers an immediate poll right when a trip starts, and roughly once a minute while a trip's detail page is open in a browser tab. So consecutive PollSnapshots for a trip can be anywhere from ~1 to ~5 minutes apart, and rules that matter must be expressed in raw time, not sample counts:

- **Trip** auto-starts on a single `shift_state == D` sample for a Vehicle with no active trip — asymmetric on purpose: a stray D-then-P-without-moving just leaves an idle trip to close manually, while waiting for a second confirming sample risks losing a real drive's data if the poll trigger stops firing before it arrives. If the live sample isn't `D`, the poll trigger also checks HA's history API over a lookback window (~6 minutes, covering the UptimeRobot baseline plus jitter) for a `D` span that both opened and closed since the last check — otherwise a Trip shorter than the poll gap could enter and leave `D` between two samples without either one ever observing it, losing the drive's data entirely despite the eager single-sample rule above. When found, the Trip is backfilled from two historical PollSnapshots bounding that span (both tagged `D`, since a DriveSegment's end is its last confirmed-driving sample — see below) instead of one live sample.
- **DriveSegment** ends once `shift_state != D` has held continuously for ≥10 minutes, regardless of how many samples that spans. A brief non-driving read (e.g. one red light) that resolves before the 10-minute grace period elapses does not split the segment.
- **ChargeSession** ends at `charging_state == Complete` — not at unplug. The idle plugged-in time after Complete is not part of the session. Unlike DriveSegment, this has no cadence sensitivity: it fires on the state transition itself, not on elapsed time or sample count.
- **RouteLog** always straight-line interpolates between consecutive GPS points, regardless of the time/distance gap between them — no special handling for missed polls.

## Open questions (not yet resolved)

(none remaining)
