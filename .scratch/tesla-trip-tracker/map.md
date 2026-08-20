Label: wayfinder:map

## Destination

A mobile-friendly TypeScript/Next.js/MongoDB web app that polls the user's Home Assistant server (Tesla integration, reached via Nabu Casa) to automatically record Trips per Vehicle (multi-car) — driving time/distance, charging time/energy/cost, and GPS route — for trips the user manually starts/stops from the app, and visualizes each trip clearly on a map + timeline/dashboard, broken down per leg (DriveSegment/ChargeSession).

## Notes

- Domain glossary lives in [CONTEXT.md](../../CONTEXT.md) — Vehicle, Trip, PollSnapshot, DriveSegment, ChargeSession, RouteLog. Consult it every session; update it if a term needs sharpening.
- Every session touching a `grilling`-type ticket should call the Skill tool for `grilling`, and `domain-modeling` if the ticket touches the glossary.
- Stack (decided, not open): TypeScript + Next.js, MongoDB (Atlas free tier M0), deployed on Vercel.
- Data source (decided): Home Assistant only, polled remotely via Nabu Casa — no direct Tesla API integration in scope.
- Poller trigger (decided): free UptimeRobot monitor hits a protected API route on an interval; no separate always-on worker.
- Segment inference (decided): brief stops (traffic lights etc.) merge into the surrounding DriveSegment rather than splitting it — exact threshold is ticketed.
- Multi-car and multi-trip supported; a Trip is always manually started/stopped by the user (never inferred).
- Cost tracking (decided): ChargeSession carries a cost field (manual €/kWh or total €) or a `free: true` flag now, even though the user's current supercharging is free — future-proofing, not deep cost analytics.
- Map rendering (decided): Mapbox.
- Auth (decided): single-user password login — implementation approach ticketed.
- Trip start/stop UX (decided): button in the web app, installable as a homescreen PWA.
- v1 dashboard scope (decided): Trip list, Trip detail (map + stat cards + per-leg breakdown of DriveSegments/ChargeSessions + chart), and a cross-trip/all-time stats page per vehicle. A live "trip in progress" view is explicitly not in v1 (see Out of scope).
- This map is planning-only (default wayfinder behavior) — tickets resolve decisions, not code. Implementation happens after the map is walked.

## Decisions so far

- [HA entity discovery](issues/01-ha-entity-discovery.md) — confirmed `alandtse/tesla` (HACS) integration, entity ids for vehicle `electra` (incl. `charger_power`), auth via HA Long-Lived Access Token over Nabu Casa.
- [Poll interval & trigger auth](issues/02-poll-interval-and-trigger-auth.md) — single endpoint, no-ops when idle, true 5-min resolution (UptimeRobot HEAD checks + Bearer header auth).
- [Segment merge threshold & ambiguous states](issues/03-segment-merge-threshold.md) — DriveSegment ends after 2 consecutive non-driving samples, ChargeSession ends at `Complete`, RouteLog always straight-line interpolates gaps.
- [Auth implementation](issues/04-auth-implementation.md) — NextAuth credentials provider, bcrypt hash in env var, ~1yr cookie, global middleware (carving out the login page and the HA-polling trigger endpoint's Bearer-secret route).
- [Charge-location place names](issues/05-charge-location-place-names.md) — Mapbox reverse-geocode at write-time, user-editable, applied to both ChargeSession and DriveSegment start/end (scope expanded beyond the original ChargeSession-only wording).
- [v1 dashboard prototype](issues/06-v1-dashboard-prototype.md) — Variant C (dashboard-grid/analytics) chosen for Trip Detail: map → chart → leg table → totals cards at the bottom. Sets the visual language for Trip List/Stats too. See [`prototypes/v1-dashboard/`](../../prototypes/v1-dashboard/).

## Not yet specified

- PWA manifest/icon/offline behavior details — minor, implementation-level polish.
- Whether/how to surface feedback that the poller is actually running (e.g. a "last synced" indicator) — minor, non-blocking cosmetic nice-to-have; can be decided during implementation rather than needing its own ticket.
- Anything beyond v1 dashboard scope (e.g. richer per-vehicle analytics) — only sketched, not sharp.

## Out of scope

- Direct Tesla Fleet API / Tessie-style direct-to-car connection — user confirmed Home Assistant-only.
- Live "trip in progress" real-time view — v1 is after-the-fact review only (Trip list/detail + cross-trip stats); user selected this out when scoping the v1 dashboard.
- Advance trip/route planning (planning charging stops ahead of time) — this tracks what happened, not what to do.
- Deep cost analytics (e.g. cost trends, price comparisons across networks) — only a basic per-session cost/free field is in scope.
