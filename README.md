# Faculty of Computing Timetable — University of Benin

A web app for building and checking the Faculty of Computing lecture timetable.
Officers drag courses around a venue × day grid, and the app flags clashes as they happen.

**What it does today**

- **Home page** (`/`, public) — about the Faculty and its departments, and every timetable grouped by programme:
  Undergraduate, Postgraduate (M.Sc., Ph.D., PGD), Part-time and Invigilation. Wording lives in
  `src/lib/site-content.ts`; schedules not built yet show "Coming soon".
- **Workspace** (`/timetable`, staff sign-in) — everything below.

- **Timetable** — the full grid (venues T, W, E, P1, P2, P4 × Monday–Friday, 8 a.m.–6:30 p.m.),
  colour-coded like the printed timetable. Drag a course to move it, click it to edit, click an empty slot to add one.
  Other faculties' bookings in shared halls show as grey striped blocks so nobody books over them.
- **Clash checks** — venue double-bookings, student clashes (same level and department, or a common course),
  lecturer double-bookings, and lectures running into Friday Jumat (1–2 p.m.).
- **Courses** — add and delete courses (a course still on the timetable can't be deleted); level, department, units, "common to all departments", and the lecturer for each course.
- **Lecturers** — the teaching staff list, with each person's courses and weekly hours.
- **Exports** — *Download Word* gives the official timetable as a `.docx` (A4 landscape, 2 pages, faculty design);
  *Print / PDF* opens the same layout for printing or "Save as PDF". Other faculties' bookings print as blanks.
- **Logins and roles** — *Faculty Time-Table Officer* (everything, accounts, sign-off), *Department Officer*
  (their own department's course lectures, courses and lecturers), *Viewer* (look and export only).
- **Settings** (Faculty Officer) — start the next semester (copy everything, only fixed periods, or nothing),
  choose the current semester, publish a semester to the public page, and add or edit venues.
- **Public timetable** (`/view`, no sign-in) — students pick level + department and see their week (their courses
  plus the level's common courses) as a phone-friendly list; lecturers by name; or by venue. Only semesters the
  Faculty Officer has **published** appear. Links are shareable, e.g. `/view?by=class&level=4&dept=CSC`.
- **History** — every change (moves, edits, deletions, courses, lecturers, sign-off, accounts) with who and when.
- **Sign-off** — the Faculty Time-Table Officer sets the signing date and adds a signature (drawn on screen or
  uploaded as a scan). Both print on the exports; until it's signed, exports show a blank date and signature line.
- **Examinations** (`/exams`) — examination timetables for Undergraduate (whole faculty), Part-time and M.Sc.
  (one per department). Dates down the side, sessions across (Morning / Afternoon / Evening, or one M.Sc. session),
  numbered SESSION 1, 2, 3 … like the official timetable. Add a paper with its venues (e.g. `COS202 (W, T, P1)`),
  papers written together (`CSC313/CSC301`), part-time year groups (`Y2`), or whole-session blocks (GST, CED).
  Drag papers between sessions. Clash checks: same students in one session, a course examined twice, and a warning
  for two papers on one day. Undergraduate timetables list the lecture-timetable courses with no exam yet.
  Each timetable has its own set-up (dates, session times, notes, signatory), sign-off, publish switch,
  Word download (A4 portrait) and Print / PDF. Department officers run their own department's timetables and add
  their own papers to the Faculty one. Students look them up at `/view/exams`.
- Loaded with the **2026/2027 First Semester** timetable.

---

## 1. Run it on your computer (first time)

You need **Node.js 20 or newer** and **Git**. Check with `node -v` and `git --version`.

```bash
# 1. Get the code
git clone https://github.com/festus-oliha/uniben-computing-timetable.git
cd uniben-computing-timetable

# 2. Open it in VS Code
code .

# 3. In the VS Code terminal (Terminal → New Terminal):
npm install          # downloads the libraries (one time, ~1 minute)
npm run db:setup     # creates the local database and loads the 2026/2027 timetable
npm run dev          # starts the app
```

Open **http://localhost:3000** in your browser. Stop the app with `Ctrl + C` in the terminal.

**The first time**, the app shows **First-time setup**: create the Faculty Time-Table Officer account (you).
Then use the **Users** tab to create accounts for department officers and viewers — each gets a temporary
password to pass on privately, and chooses their own password at first sign-in.

> **No database setup needed for local work.** When `DATABASE_URL` is empty the app uses a built-in
> Postgres database stored in the `.data/` folder on your computer. Delete that folder and run
> `npm run db:setup` again to start fresh (this also deletes the accounts).
>
> ⚠️ The built-in database can only be used by **one program at a time**. Stop the app (`Ctrl + C`)
> before running any `npm run db:…` or `npm run user:…` command, then start it again.
>
> Keep the project folder **outside OneDrive/Dropbox** (e.g. `C:\Users\<you>\Projects`) — syncing the
> `.data` folder while the app writes to it can damage the database.

## 2. Everyday work

```bash
git pull             # get the latest changes
npm install          # only needed if package.json changed
npm run db:migrate   # only needed if a new file appeared in drizzle/ (safe to run any time)
npm run db:seed      # adds any new venues from the seed file (e.g. the examination venues); keeps your edits
npm run dev          # start the app at http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app locally with live reload |
| `npm test` | Runs the clash-engine tests |
| `npm run typecheck` | Checks the TypeScript for mistakes |
| `npm run check` | Both of the above — run before pushing |
| `npm run build` | Builds the production version (what Netlify runs) |
| `npm run db:setup` | Creates tables and loads the timetable (safe to re-run) |
| `npm run db:seed -- --reset` | Puts the 2026/2027 timetable back to the original, discarding moves |
| `npm run db:generate` | After changing `src/lib/db/schema.ts`, writes a new migration into `drizzle/` |
| `npm run user:reset-password -- you@example.com` | Locked out? Prints a new temporary password (run with no email to list accounts) |

Every push to GitHub runs the tests and a build on **GitHub Actions** (free, separate from Netlify credits).

## 3. Using Supabase instead of the local database

Use this when you're ready to deploy, or when several people need to share one database.

1. Create a free project at **supabase.com** (choose a region close to Nigeria, e.g. Europe West).
2. In the project: **Project Settings → Database → Connection string → "Transaction pooler"**. Copy the URI
   (port **6543**) and put your database password into it.
3. Copy `.env.example` to `.env.local` and paste it in:
   ```
   DATABASE_URL=postgresql://postgres.xxxx:YOUR-PASSWORD@aws-0-eu-west-2.pooler.supabase.com:6543/postgres
   ```
4. Run `npm run db:setup` once to create the tables and load the timetable in Supabase.
5. `npm run dev` now reads and writes Supabase.

`.env.local` is in `.gitignore` — passwords never go to GitHub.

## 4. Deploying to Netlify (and keeping credits under control)

**First deploy (once):**

1. On **app.netlify.com**: **Add new site → Import an existing project → GitHub** → pick this repository.
   Netlify reads `netlify.toml`, so leave the build settings as they are.
2. Before deploying, open **Site configuration → Environment variables** and add
   `DATABASE_URL` — your Supabase transaction-pooler URI (step 3 above).
3. Deploy, open the site **straight away**, and complete **First-time setup** to create the Faculty
   Time-Table Officer account. (Until that account exists, whoever opens the site first could create it.)

**Then pause automatic builds** so pushes to GitHub don't use credits:
**Site configuration → Build & deploy → Continuous deployment → Build settings → Configure → Stop builds**.

**When a batch of changes is ready to go live**, either:
- turn builds back on (**Activate builds**), let one deploy run, then stop them again; or
- deploy from your computer without touching the setting:
  ```bash
  npm install -g netlify-cli
  netlify login
  netlify link          # once, pick this site
  netlify deploy --build --prod
  ```

## 5. How the code is organised

```
src/
  app/                  Pages (Next.js App Router)
    page.tsx            Timetable grid
    courses/            Courses tab
    lecturers/          Lecturers tab
    clashes/            Full clash list
    print/              Paper layout for Print / Save as PDF
    export/docx/        Word download (GET /export/docx)
    view/               Public timetable (no sign-in) — only published semesters; view/exams for examinations
    (app)/exams/        Examination timetables: list, board (?tab=setup|sign), print
    export/exam/[id]/   Examination Word download (public once published)
    exam-actions.ts     All examination saves (server actions)
    sign/               Sign-off: signing date + drawn or uploaded signature
    actions.ts          All saves/moves/deletes (server actions, validated on the server)
  components/           Screen pieces: TimetableBoard (grid + drag-and-drop), BookingDrawer, tables …
  lib/
    clash.ts            ★ The clash engine — pure functions, no database
    clash.test.ts       Tests for the clash engine
    public-view.ts      Which lectures a class / lecturer / venue sees on the public page + tests
    semester.ts         Session format, next-semester suggestion, copy options + tests
    exam.ts             ★ Examination rules: dates, session numbering, clash checks, public lists + tests
    programmes.ts       Programmes (UG, PT, M.Sc., Ph.D., PGD) and their default sessions, days and notes
    exam-data.ts        Database reads for the examination pages
    signoff.ts          Sign-off rules (date format, image checks, print sizing) + tests
    timetable.ts        Days, time slots, departments, colour rules
    export/             Word builder, print layout, and the fixed wording on page 2
                        (notes, distribution list, signatory → export/document-text.ts)
    data.ts             Database reads for the pages
    db/schema.ts        Database tables
    db/client.ts        Picks Supabase (DATABASE_URL) or the local database
  middleware.ts         Sends visitors without a sign-in cookie to /login
  app/login, app/setup  Sign-in and first-time setup (outside the signed-in layout)
  app/(app)/            Everything behind sign-in: timetable, courses, users, account …
  lib/auth/             Password hashing (scrypt) and sessions (cookie + sessions table)
  lib/permissions.ts    ★ Who may change what — used by both the screens and the server actions
drizzle/                SQL migrations (generated — don't edit by hand)
seed/                   The 2026/2027 First Semester timetable as data
scripts/                migrate and seed commands
```

**Slots** are numbered 0–9: `0` = 8–9 a.m. … `5` = 1–2 p.m., `6` = 2:30–3:30 … `9` = 5:30–6:30.
**Days** are 0 (Monday) – 4 (Friday). A booking never crosses the 2:00–2:30 break.

**Changing the printed notes, distribution list or signatory name:** edit `src/lib/export/document-text.ts`.
The "Signed" date and signature come from the **Sign-off** tab (stored per semester), not the export date.

**Changing the clash rules:** edit `src/lib/clash.ts`, add a test in `src/lib/clash.test.ts`, run `npm test`.

## 6. Roadmap

1. ✅ Timetable grid, drag-and-drop, clash checks, courses, lecturers
2. ✅ Word/PDF export in the official faculty timetable design, with online sign-off
3. ✅ Logins with roles — Faculty Officer (everything), Department Officer (own department), Viewer
4. ✅ Change history
5. ✅ Settings: start the next semester, publish, venues
6. ✅ Public read-only view for students and lecturers, filtered by level, department, lecturer or venue
7. ✅ Examination timetables (Undergraduate, Part-time, M.Sc.) with clash checks, Word/PDF, sign-off and public look-up
8. ⏳ Invigilation schedules — chief invigilator + assistants per paper, fair suggestions, duty counts
9. ⏳ Part-time and M.Sc. lecture timetables (per department)
