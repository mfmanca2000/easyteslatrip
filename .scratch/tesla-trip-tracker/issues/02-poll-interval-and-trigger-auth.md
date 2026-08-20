Type: grilling
Status: resolved

## Question

Decide the concrete polling design: how often the UptimeRobot-triggered API route polls HA, whether that interval should differ while a Trip is active vs idle, and how the trigger endpoint is protected (shared secret in the URL, header token, etc.) so it can't be hit by an outsider. Also decide how this interval interacts with the DriveSegment merge threshold from [Segment merge threshold & ambiguous states](03-segment-merge-threshold.md) — too coarse a poll interval undermines a short merge threshold.

## Answer

- **Idle behavior:** single endpoint. UptimeRobot always hits the same URL; the route checks Mongo for an active Trip first and no-ops (cheap, no HA call) when none is active.
- **Active-trip resolution:** true 5-minute resolution — one HA poll per invocation, matching UptimeRobot's free-tier floor. No in-invocation fan-out.
- **Trigger method:** UptimeRobot free tier only supports HEAD checks. That's fine — the route still runs its full poll-and-write logic server-side on a HEAD request (the HTTP method doesn't limit server-side work) and returns a bare 200; UptimeRobot only reads the status code.
- **Endpoint auth:** shared secret via `Authorization: Bearer <secret>` custom header, configured in the UptimeRobot monitor and checked against a Vercel env var. Works with HEAD requests since the header is present regardless of method.
- **Gap handling:** resolved by [Segment merge threshold & ambiguous states](03-segment-merge-threshold.md) — no separate time-based gap-tolerance threshold; gaps are always straight-line interpolated on the map, and whether a DriveSegment actually ends is decided by consecutive-sample count (2 non-driving samples), not raw elapsed time.
- **Interaction with segment-merge threshold:** poll resolution is fixed at 5 minutes, so the merge rule is expressed in samples rather than minutes — see [Segment merge threshold & ambiguous states](03-segment-merge-threshold.md).
