# Notes for Claude (and other contributors)

Faculty of Computing, University of Benin — lecture timetable manager. Owner: F. O. Oliha (Faculty Time-Table Officer).

## Stack
Next.js 15 (App Router, server actions) · React 19 · TypeScript · Tailwind 4 (+ plain CSS tokens in `src/app/globals.css`)
· dnd-kit · Drizzle ORM · Postgres (Supabase in production, PGlite locally when `DATABASE_URL` is empty) · Vitest · Netlify.

## Rules of the house
- **Never move courses in the seeded timetable without being asked.** Blank-looking slots in shared halls (T, W, E)
  are often used by other faculties; those bookings are stored with `kind = "shared"`.
- Venue display order is T → W → E → P1 → P2 → P4 (`venues.sort_order`).
- P1 = 400 Level CSC class, P2 = 300 Level CSC class, P4 = Ground Floor LT for Computing Students (all Statistics Building).
- Clash logic lives only in `src/lib/clash.ts` and must stay pure (no DB, no React). Add tests for every rule change.
- All writes go through `src/app/actions.ts`, which validates on the server.
- Schema change → edit `src/lib/db/schema.ts`, run `npm run db:generate`, commit the new file in `drizzle/`.
- Netlify builds are usually paused to save credits; GitHub Actions runs checks for free. Work on localhost.
- Before committing: `npm run check` and `npm run build`.
- The printed "Signed" date and signature come from the semester's sign-off (Sign-off tab), never the export date.
- Permissions live only in `src/lib/permissions.ts` (pure, tested). Every server action calls `guard()` (signed-in check)
  and the matching permission function; screens use the same functions to hide/disable controls.
- Roles: admin = Faculty Time-Table Officer; dept_officer edits only course lectures whose courses are all in their dept
  (never COS/common, tutorials, PT or other-faculty bookings); viewer is read-only.
- PGlite allows one process at a time: stop `npm run dev` before running db/user scripts.
