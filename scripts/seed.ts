/**
 * Loads the 2026/2027 First Semester timetable (seed/2026-2027-first-semester.json).
 *
 *   npm run db:seed            → loads it if that semester isn't in the database yet
 *   npm run db:seed -- --reset → replaces that semester's bookings with the file's contents
 *
 * Venues and courses are added if missing and never overwritten, so edits made in the app are kept.
 */
import "./env";
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "../src/lib/db/client";
import { bookings, courses, semesters, venues } from "../src/lib/db/schema";

type SeedFile = {
  semester: { session: string; name: string };
  venues: { code: string; name: string; seats: number; sortOrder: number }[];
  courses: { code: string; level: number; dept: string; isCommon: boolean }[];
  bookings: {
    venue: string;
    day: number;
    start: number;
    span: number;
    label: string;
    kind: "course" | "activity" | "pt" | "shared";
  }[];
};

async function main() {
  const reset = process.argv.includes("--reset");
  const data = JSON.parse(readFileSync("seed/2026-2027-first-semester.json", "utf8")) as SeedFile;
  const db = getDb();

  await db.insert(venues).values(data.venues).onConflictDoNothing();
  await db
    .insert(courses)
    .values(data.courses.map((c) => ({ code: c.code, level: c.level, dept: c.dept, isCommon: c.isCommon })))
    .onConflictDoNothing();

  let [sem] = await db
    .select()
    .from(semesters)
    .where(and(eq(semesters.session, data.semester.session), eq(semesters.name, data.semester.name)));

  if (sem && !reset) {
    const existing = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.semesterId, sem.id));
    if (existing.length) {
      console.log(
        `• ${data.semester.session} ${data.semester.name} already has ${existing.length} bookings — left unchanged.` +
          `\n  Run "npm run db:seed -- --reset" to replace them with the original timetable.`,
      );
      await closeDb();
      return;
    }
  }

  if (!sem) {
    const anyCurrent = (await db.select().from(semesters).where(eq(semesters.isCurrent, true))).length > 0;
    [sem] = await db
      .insert(semesters)
      .values({ session: data.semester.session, name: data.semester.name, isCurrent: !anyCurrent })
      .returning();
  }

  await db.delete(bookings).where(eq(bookings.semesterId, sem.id));
  await db.insert(bookings).values(
    data.bookings.map((b) => ({
      semesterId: sem.id,
      venueCode: b.venue,
      day: b.day,
      start: b.start,
      span: b.span,
      label: b.label,
      kind: b.kind,
    })),
  );

  console.log(
    `✔ Loaded ${data.semester.session} ${data.semester.name}: ${data.venues.length} venues, ` +
      `${data.courses.length} courses, ${data.bookings.length} bookings.`,
  );
  await closeDb();
}

main().catch(async (err) => {
  console.error("✖ Seeding failed:", err);
  await closeDb();
  process.exit(1);
});
