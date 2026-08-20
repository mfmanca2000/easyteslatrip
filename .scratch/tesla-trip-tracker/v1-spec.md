Label: ready-for-agent

# EasyTeslaTrip — v1 Spec

## Problem Statement

The user drives a Tesla (`electra`) and wants a record of road trips — where they drove, how long, how far, where and how much they charged, and what it cost — without manually logging any of it while driving. Today this data exists only transiently in Home Assistant (via the `alandtse/tesla` HACS integration) and nowhere durable or visual. There's no way to look back at a trip and see the route on a map, how driving and charging time broke down leg by leg, or compare trips over time per vehicle.

## Solution

A mobile-friendly TypeScript/Next.js/MongoDB web app, installable as a homescreen PWA, that:

- Polls the user's Home Assistant server (reached remotely via Nabu Casa) on a fixed interval while a Trip is active, and turns the resulting stream of snapshots into structured DriveSegments and ChargeSessions.
- Lets the user manually start and stop a Trip per Vehicle from the app (trips are never auto-detected).
- Visualizes each Trip on a map with a battery-over-trip chart, a per-leg (DriveSegment/ChargeSession) breakdown table, and trip-total stat cards.
- Shows a Trip list and a cross-trip/all-time stats page per Vehicle.
- Is protected by a single-user password login, and supports multiple Vehicles (multi-car).

Domain vocabulary (Vehicle, Trip, PollSnapshot, DriveSegment, ChargeSession, RouteLog) is defined in [CONTEXT.md](../../CONTEXT.md) and used throughout.

## User Stories

1. As the user, I want to log in with a single password on my phone, so that only I can access my trip data.
2. As the user, I want my login to persist for about a year, so that I'm not re-prompted every time I open the homescreen PWA.
3. As the user, I want to see a list of my registered Vehicles, so that I can pick which car's trips I'm viewing.
4. As the user, I want to tap a button to start a Trip for a given Vehicle, so that the app begins recording from that point.
5. As the user, I want to tap a button to stop the active Trip, so that recording ends at a point I control, not one the app infers.
6. As the user, I want the app to prevent starting a second Trip for a Vehicle that already has one active, so that Trips never overlap for the same Vehicle.
7. As the app, I want to poll Home Assistant automatically on a fixed schedule while a Trip is active, so that driving and charging data is captured without the user doing anything while en route.
8. As the app, I want to no-op cheaply (skip the HA call entirely) when no Trip is active for any Vehicle, so that idle polling doesn't waste HA/Nabu Casa calls.
9. As the app, I want the polling trigger endpoint protected by a bearer-secret header, so that only the configured UptimeRobot monitor can invoke it.
10. As the app, I want to accept the polling trigger via a HEAD request, so that it works within UptimeRobot's free-tier monitor type.
11. As the app, I want every poll to be stored as a raw PollSnapshot (battery %, shift_state, charging_state, odometer, GPS, charger_power, energy_added), so that DriveSegments/ChargeSessions/RouteLog can be derived or reprocessed later without re-polling HA.
12. As the app, I want to derive DriveSegments from consecutive PollSnapshots using the shift_state != D rule, so that periods of driving are captured as discrete, summarized legs.
13. As the app, I want a single non-driving sample surrounded by driving samples to be treated as noise (not a segment break), so that a red light or momentary stop doesn't fragment one drive into multiple segments.
14. As the app, I want a DriveSegment to end only after 2 consecutive non-driving samples, so that segment boundaries are stable at the fixed 5-minute poll resolution.
15. As the app, I want to derive ChargeSessions from consecutive PollSnapshots using the charging_state rule, so that periods of charging are captured as discrete, summarized legs.
16. As the app, I want a ChargeSession to end at charging_state == Complete rather than at unplug, so that charging-duration stats reflect actual charging activity, not idle plugged-in time.
17. As the app, I want every GPS point from PollSnapshots to be appended to the Trip's RouteLog, so that the full route can be drawn on the map.
18. As the app, I want RouteLog points to always be straight-line interpolated between consecutive points regardless of gap size, so that the map draws a continuous path even across missed polls, without special-casing outages.
19. As the app, I want to reverse-geocode a place name via Mapbox when a DriveSegment or ChargeSession closes, so that the user sees a human-readable location instead of raw coordinates.
20. As the app, I want the geocoded place name stored on the entity at write-time (not re-fetched on every view), so that repeated page loads don't re-hit the Mapbox API.
21. As the user, I want to edit the place name on any DriveSegment or ChargeSession, so that I can correct a bare road name into something meaningful (e.g. "Supercharger - Bologna Nord").
22. As the user, I want to enter a cost for a ChargeSession as either a €/kWh rate or a total €, so that I can track what a charge cost me.
23. As the user, I want to mark a ChargeSession as free instead of entering a cost, so that free supercharging sessions don't need a fabricated cost value.
24. As the user, I want to see a list of my Trips per Vehicle, so that I can find a past trip quickly.
25. As the user, I want to open a Trip and see its route drawn on a map, so that I can visually retrace where I went.
26. As the user, I want to see a battery-over-trip chart on the Trip detail page, so that I can see how my charge level evolved across the trip.
27. As the user, I want to see a per-leg table listing each DriveSegment and ChargeSession in order, so that I can review the trip leg by leg.
28. As the user, I want to see trip-total stat cards (distance, driving time, charging time, energy added, total cost) at the bottom of the Trip detail page, so that I get the summary after reviewing the detail, matching the confirmed map → chart → table → totals layout.
29. As the user, I want a cross-trip/all-time stats page per Vehicle, so that I can see totals and trends across all my trips with that car.
30. As the user, I want the app usable on my phone as an installable PWA, so that starting/stopping trips feels like using a native app, not a mobile website.
31. As the user, I want to register more than one Vehicle, so that I can track trips across multiple Teslas.
32. As the app, I want each Trip, DriveSegment, ChargeSession, PollSnapshot, and RouteLog point to be scoped to exactly one Vehicle, so that multi-car data never crosses between vehicles.

## Implementation Decisions

**Stack**
- TypeScript + Next.js, deployed on Vercel.
- MongoDB Atlas (free tier M0) as the datastore.
- Mapbox for map rendering and reverse geocoding (Geocoding API, free tier: 100k req/month).
- NextAuth (Auth.js) for auth, credentials provider, single hardcoded user — no adapter/DB-backed session table.

**Data model** (per [CONTEXT.md](../../CONTEXT.md))
- `Vehicle`: HA device/entity-prefix identity; a user may register multiple.
- `Trip`: belongs to one Vehicle; manually started/stopped; owns DriveSegments, ChargeSessions, RouteLog for its time window; Trips never overlap for the same Vehicle.
- `PollSnapshot`: raw poll record (battery %, shift_state, charging_state, odometer, lat/long, charger_power, energy_added) — retained as audit trail / reprocessing source.
- `DriveSegment`: start/end time, start/end odometer, distance, duration, start/end GPS point, start/end place name (geocoded, user-editable).
- `ChargeSession`: location (GPS + place name, geocoded, user-editable), start/end time, duration, start/end battery %, energy added (kWh), cost (`€/kWh` manual, total `€` manual, or `free: true`).
- `RouteLog`: ordered GPS points for a Trip, straight-line interpolated between consecutive points for map drawing; distinct from DriveSegment's time/distance summary.

**HA integration**
- Integration: `alandtse/tesla` (community `tesla_custom`, HACS). Entity naming pattern: `<domain>.<vehicle_name>_<field>`, repeats per additional vehicle.
- Confirmed entities for `electra`: `sensor.electra_battery`, `binary_sensor.electra_charging`, `sensor.electra_energy_added`, `binary_sensor.electra_charger`, `sensor.electra_odometer`, `sensor.electra_shift_state`, `device_tracker.electra_location_tracker`, `sensor.electra_charger_power`.
- Auth to HA: Long-Lived Access Token over the Nabu Casa remote URL.

**Polling design**
- Single trigger endpoint, invoked by a free-tier UptimeRobot monitor via HEAD request on an interval matching the true 5-minute floor.
- Endpoint logic: check MongoDB for an active Trip first; no-op (no HA call) if none is active; otherwise perform one HA poll and write one PollSnapshot, deriving/updating DriveSegment, ChargeSession, and RouteLog state as needed.
- Endpoint auth: `Authorization: Bearer <secret>` header, checked against a Vercel env var; independent of the human NextAuth session.
- No separate always-on worker and no in-invocation fan-out — one poll per invocation.

**Segment inference algorithm**
- DriveSegment ends after 2 consecutive non-driving samples (`shift_state != D`); a single non-driving sample surrounded by driving samples does not split the segment.
- ChargeSession ends at `charging_state == Complete`, not at unplug.
- RouteLog always straight-line interpolates between consecutive GPS points regardless of gap size — no special handling for missed polls or outages (UptimeRobot's own downtime alerting covers that failure mode).
- No separate time-based gap-tolerance threshold exists; the consecutive-sample rule and interpolation fully replace it.

**Reverse geocoding**
- Triggered once at write-time when a DriveSegment or ChargeSession closes (not on every page view).
- Applies to both DriveSegment start/end points and ChargeSession location.
- Stored on the entity; user-editable via the Trip detail page, overriding the geocoded default.

**Auth implementation**
- NextAuth credentials provider, single hardcoded user, no DB-backed session table.
- Password stored as a bcrypt hash in a Vercel env var; login route runs `bcrypt.compare`.
- Session: signed httpOnly cookie, ~1 year expiry.
- Global `middleware.ts` requires a valid session for all routes, carving out: the login page + NextAuth's `/api/auth/*` routes, and the HA-polling trigger endpoint (protected separately by its own bearer secret, not by human session).

**v1 UI scope** (Variant C — dashboard grid / analytics, validated via [prototype](../../prototypes/v1-dashboard/))
- **Trip List**: per-Vehicle list of Trips, vehicle-switcher tabs, add/start-trip affordance.
- **Trip Detail**: map (route + start/end/charge pins) → battery-over-trip chart → per-leg table (DriveSegment/ChargeSession rows with place, time, stat) → trip-totals stat cards (distance, driving time, charging time, energy added, total cost/free) at the bottom. This map → chart → table → totals order is a confirmed, deliberate layout decision — not incidental.
- **All-time Stats**: cross-trip stats page per Vehicle, same dark-theme/card-based visual language as the other two pages (hero total + stat grid), vehicle-switcher tabs.
- Visual language: dark theme, card-based stat chips, compact leg table, bottom-anchored totals, `<480px` mobile-first container — applies to all three pages even though only Trip Detail was multi-variant tested.
- PWA: installable homescreen app; manifest/icon/offline-behavior details are implementation-level polish, not separately specced.

## Testing Decisions

- Segment-inference logic (DriveSegment/ChargeSession boundary detection from a sequence of PollSnapshots) is the highest-value seam to test: pure function(s) over an array of snapshots → derived segments, independent of HA, Mongo, or the HTTP layer. Prefer one seam here — a single `deriveSegments(snapshots) -> { driveSegments, chargeSessions, routeLog }`-shaped function — over scattering the rule across the polling route.
- Good tests here assert on external behavior: given a sequence of snapshots (including the noise case — one lone non-driving sample, and the Complete-but-still-plugged-in case), assert the resulting segment boundaries and durations, not internal intermediate state.
- The polling trigger endpoint's auth check (bearer secret) and idle no-op behavior (no HA call when no active Trip) should be covered at the route level.
- Reverse-geocoding and Mapbox calls should be mocked/stubbed in tests — no real network calls to Mapbox or HA in the test suite.
- No existing test setup in this repo yet (no git repo exists at spec time) — testing framework/conventions to be established during implementation, following whatever the Next.js project scaffold defaults to unless the user has an existing preference.

## Out of Scope

- Direct Tesla Fleet API / Tessie-style direct-to-car connection — Home Assistant is the only data source.
- Live "trip in progress" real-time view — v1 is after-the-fact review only.
- Advance trip/route planning (planning charging stops ahead of time).
- Deep cost analytics (cost trends, price comparisons across networks) — only a basic per-session cost/free field is in scope.
- PWA manifest/icon/offline-behavior fine detail — left to implementation-time polish.
- A "last synced"/poller-health indicator in the UI — non-blocking cosmetic nice-to-have, can be added during implementation without a separate spec.

## Further Notes

- This spec synthesizes six resolved wayfinder tickets (HA entity discovery, poll interval & trigger auth, segment merge threshold, auth implementation, charge-location place names, v1 dashboard prototype) tracked in [map.md](map.md); consult that file and its linked issues for the full decision history and rationale behind each point above.
- No git repo exists yet for this project — the prototype HTML files under `prototypes/v1-dashboard/` are the primary visual reference for the v1 UI until a real implementation repo is created.
- No issue tracker/triage-label vocabulary was configured for this session (`/setup-matt-pocock-skills` not yet run), so this spec was written to a file (`v1-spec.md`) rather than published to a tracker. It carries the `ready-for-agent` label in its header for whenever it is imported into one.
