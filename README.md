# EasyTeslaTrip

Tesla road-trip tracker. Polls Home Assistant, derives Trips/DriveSegments/ChargeSessions, visualizes on a map. See [CONTEXT.md](./CONTEXT.md) for domain vocabulary and [.scratch/tesla-trip-tracker/v1-spec.md](./.scratch/tesla-trip-tracker/v1-spec.md) for the full v1 spec.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values, see below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`GET /api/health` pings MongoDB and reports connection status — used to verify the build → deploy → DB-connect pipeline.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run test` — run the test suite (Vitest)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint

## Environment variables

Set these in `.env.local` for local dev, and as Vercel project env vars for deployed environments. See `.env.example` for the full list with placeholders.

| Var | Used by | Notes |
| --- | --- | --- |
| `MONGODB_URI` | `src/lib/mongodb.ts`, `/api/health` | MongoDB Atlas connection string (M0 free tier). |
| `MONGODB_DB` | `/api/health` | Database name; defaults to `easyteslatrip` if unset (needed since Atlas connection strings often omit a `/dbname` path). |
| `HA_BASE_URL` | HA polling ingestion (not yet implemented) | Nabu Casa remote URL for the user's Home Assistant instance. |
| `HA_LONG_LIVED_TOKEN` | HA polling ingestion (not yet implemented) | Long-Lived Access Token generated in HA, used to authenticate polls. |
| `MAPBOX_TOKEN` | Reverse geocoding + map rendering (not yet implemented) | Mapbox access token (Geocoding API + map tiles). |
| `AUTH_SECRET` | NextAuth (not yet implemented) | Random secret NextAuth uses to sign session cookies. |
| `AUTH_PASSWORD_HASH` | NextAuth credentials provider (not yet implemented) | bcrypt hash of the single hardcoded user's password. |
| `POLL_TRIGGER_SECRET` | Polling trigger endpoint (not yet implemented) | Bearer secret the UptimeRobot monitor sends; unrelated to the human NextAuth session. |

## Deploy

Deployed on Vercel, connected to a MongoDB Atlas (free tier M0) cluster. See the project's GitHub issue tracker for setup tickets.
