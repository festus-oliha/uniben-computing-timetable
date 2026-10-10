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
- Every server action that changes data also calls `logChange()` (src/lib/audit.ts) with a plain-language summary.
- The app is **FaCoMS** (Faculty of Computing Management System). `/` is the public FaCoMS home with the module board
  (Departments, Faculty News, Timetable, Staff Members, Prospectus); module list, about text and departments live in
  `src/lib/site-content.ts` (`MODULES`, `SITE`). Timetable module hub: `/timetables`; staff timetable workspace: `/timetable`;
  modules still being built show `/modules/[slug]`. Departments: `/departments` and `/departments/[code]` (staff,
  timetables); Projects, Seminars and Results & Records belong to each department page (`DEPARTMENT_FEATURES`). Logo: `src/components/brand/FacomsLogo.tsx` (favicon `src/app/icon.svg`).
  Every public page links to https://www.uniben.edu/. Printed documents keep the UNIBEN crest.
  The Dean's profile/photo, mission and vision are edited in Settings → Home page (table `site_content`, key "home",
  rules in `src/lib/home-content.ts`); the home section stays hidden until filled. Footers credit
  "Software built by JVeeSoft-IT. © 2026" (`Credit` in src/components/brand/SiteChrome.tsx).
- Exams: `src/lib/exam.ts` (pure, tested) holds exam clash rules; writes go through `src/app/exam-actions.ts`.
  An exam timetable has `dept = null` (Faculty-wide undergraduate) or a department (PT, M.Sc. …). Venues with
  `in_lecture_grid = false` are exam-only and never appear on the lecture grid. Venues are not clash-checked in exams
  (big halls hold several papers at once).
- Invigilation: rules in `src/lib/invigilation.ts` (pure, tested); writes in `src/app/invigilation-actions.ts`.
  The chief invigilator is ALWAYS chosen by the officer in charge — never auto-filled — and can never be a lecturer
  of the paper's course. Suggestions fill empty assistant places only; never overwrite anyone assigned.
  exam_papers.invigilator_ids holds assistants only (chief is chief_id). Only canManageExamTimetable may change it.
- Part-time / PG lecture timetables: rules in `src/lib/programme.ts` (pure, tested); writes in
  `src/app/programme-actions.ts`; permission `canManageProgrammeTimetable` (admin or that dept's officer).
  Days use JS weekday numbers (0 = Sunday); rows are `groups`; periods may be breaks (classes never cross one).
  Venue letters are per timetable (`venue_key`), separate from the Faculty venue list.
- Staff Members: the `lecturers` table IS the staff list (timetables, invigilation and the directory share it).
  Rules in `src/lib/staff.ts` (pure, tested: ranks, categories, departments, import parsing, name matching);
  writes in `src/app/staff-actions.ts` (permission `canManageLecturer`: admin, or the dept officer for their dept).
  Public directory `/staff`, profiles `/staff/[id]` never show email/phone/staff no./office (only signed-in staff see them).
  Photos are served by `/staff-photo/[id]`. Staff workspace: `/workspace/staff` (list, add, import, Excel export).
  Spreadsheet files are parsed only in the browser (xlsx 0.18.5); the server only receives cleaned rows.
