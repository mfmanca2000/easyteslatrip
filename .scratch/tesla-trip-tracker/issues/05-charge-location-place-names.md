Type: grilling
Status: resolved

## Question

Decide whether ChargeSession locations get reverse-geocoded into a human-readable place name (e.g. via the Mapbox Geocoding API, since Mapbox is already in the stack) or whether the UI just shows raw GPS/pins without a resolved name.

## Answer

- **Reverse geocoding:** yes, via the Mapbox Geocoding API (free tier: 100k req/month, trivial for this volume). Resolved once at **write-time** — when a ChargeSession closes (at `Complete`, per [Segment merge threshold & ambiguous states](03-segment-merge-threshold.md)) or a DriveSegment closes (2 consecutive non-driving samples) — and the name is stored on the entity, not re-fetched on every page view.
- **Editable:** yes. The geocoded name is the default/starting value; the Trip detail page lets the user override it (e.g. correct a bare road name to "Supercharger - Bologna Nord").
- **Scope:** both ChargeSession locations AND DriveSegment start/end points get a place name, same write-time + editable pattern for both — not ChargeSession-only as originally scoped in the ticket question. This is a scope expansion over the original ticket wording, decided during grilling.
- **Domain model impact:** DriveSegment and ChargeSession both gain a place-name field (geocoded default, user-editable override). Recorded in [CONTEXT.md](../../../CONTEXT.md).
