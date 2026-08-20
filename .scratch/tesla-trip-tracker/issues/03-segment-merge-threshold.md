Type: grilling
Status: resolved

## Question

Pin the exact algorithm for turning PollSnapshots into DriveSegments/ChargeSessions: the merge-threshold duration for brief stops (already decided: merge, not split — exact minutes TBD), and how to handle ambiguous states such as `charging_state == Complete` while still plugged in (does the ChargeSession end at `Complete`, or when unplugged?), and brief GPS/connectivity gaps mid-drive.

Constraint from [Poll interval & trigger auth](02-poll-interval-and-trigger-auth.md): poll resolution is fixed at 5 minutes (UptimeRobot free-tier floor, single poll per invocation), so the merge threshold should be set at or below ~5 minutes to be achievable, and should reuse/align with that ticket's gap-tolerance threshold rather than defining a conflicting one.

## Answer

At the fixed 5-minute poll resolution, "minutes" isn't the right unit for the merge rule — it's stated in consecutive samples instead:

- **DriveSegment end:** 2 consecutive non-driving samples (`shift_state != D`, roughly ~10 min) end the segment. A single lone P-state sample (one red light/queue caught mid-poll) is noise and does not split it.
- **ChargeSession end:** ends at `charging_state == Complete`, not at unplug. Charging activity (`energy_added`, `charger_power`) flatlines at Complete anyway, so this gives an accurate charging-duration stat; the idle plugged-in-but-done time afterward is not part of the session.
- **RouteLog gaps:** always straight-line interpolate between consecutive GPS points, regardless of gap size — no dashed/special styling. Note: an extreme gap (e.g. a multi-hour outage) will draw as one long straight line; not special-cased since UptimeRobot's own downtime alerting covers that failure mode, not the app.
- **Missed-poll gap tolerance (resolves the open item left by [Poll interval & trigger auth](02-poll-interval-and-trigger-auth.md)):** superseded by the interpolation answer above — there is no separate gap-tolerance threshold. Any gap between consecutive PollSnapshots is just drawn/treated as continuous via straight-line interpolation; only the DriveSegment 2-consecutive-sample rule (not a raw time gap) decides whether a segment actually ends.

Recorded in [CONTEXT.md](../../../CONTEXT.md) under a new Segment inference rules section.
