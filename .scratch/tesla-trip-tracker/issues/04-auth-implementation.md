Type: grilling
Status: resolved

## Question

Decide the concrete single-user password-login implementation: NextAuth (credentials provider) vs a lightweight custom signed-cookie check, session length/expiry, and where the password/secret is stored (env var vs hashed in Mongo).

## Answer

- **Library:** NextAuth (Auth.js), credentials provider, single hardcoded user (no adapter/DB-backed session table needed).
- **Password storage:** bcrypt hash stored in a Vercel env var (generated once via a small script); login route runs `bcrypt.compare` against the submitted password. No plaintext password in config anywhere.
- **Session:** signed httpOnly cookie, ~1 year expiry — login once on the phone (homescreen PWA), effectively never re-prompted.
- **Route protection:** a single global `middleware.ts` requires a valid session for all routes, with two explicit carve-outs:
  - the login page and NextAuth's own `/api/auth/*` routes (or the app can't log in at all)
  - the HA-polling trigger endpoint from [Poll interval & trigger auth](02-poll-interval-and-trigger-auth.md), which is a separate machine-to-machine call authenticated by its own `Authorization: Bearer <secret>` header, not by a human NextAuth session — it must be excluded from the human-login gate or UptimeRobot can never reach it.
