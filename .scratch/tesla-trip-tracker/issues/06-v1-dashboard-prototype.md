Type: prototype
Status: resolved

## Question

Raise the fidelity of the v1 UI: rough out the Trip list page, the Trip detail page (Mapbox route + stat cards + per-leg breakdown listing each DriveSegment/ChargeSession + a chart, e.g. battery over distance/time), and the cross-trip/all-time stats page per vehicle. Produce a concrete, reactable mockup or stub rather than deciding this in the abstract.

## Answer

Three structurally different Trip Detail variants were prototyped (map-first/immersive, timeline/journal, dashboard-grid/analytics), plus single mockups of Trip List and All-time Stats in the same visual language, as self-contained HTML in [`prototypes/v1-dashboard/`](../../../prototypes/v1-dashboard/) (`trip-detail.html` has the A/B/C switcher, `trip-list.html`, `stats.html`).

**Winner: Variant C — dashboard grid / analytics.** KPI stat cards, map, battery-over-trip chart, per-leg table. One layout tweak from the initial draft: the KPI totals cards move to the **bottom** of the page (after map, chart, and the leg table), not the top — confirmed by the user. Final order: map → chart → per-leg table → trip-totals cards.

This sets the visual/structural direction (dark theme, card-based stat chips, compact leg table, bottom-anchored totals) for Trip List and All-time Stats too, even though those weren't multi-variant tested — they should follow Variant C's density and layout language when built for real.

No git repo exists yet in this project, so the prototype files stay in place under `prototypes/` (clearly marked as throwaway/prototype in their header comments) rather than being moved to a throwaway branch — they're the primary source for this decision until a real implementation repo exists.
