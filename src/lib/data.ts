import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { bookings, courseLecturers, courses, lecturers, semesters, venues } from "./db/schema";
import { findClashes, type CourseInfo } from "./clash";
import type { TimetableData } from "./types";

/** The semester marked current, or the most recent one. */
export async function getCurrentSemester() {
  const [cur] = await db.select().from(semesters).where(eq(semesters.isCurrent, true)).limit(1);
  if (cur) return cur;
  const [latest] = await db.select().from(semesters).orderBy(desc(semesters.id)).limit(1);
  return latest ?? null;
}

/** Everything the screens need for one semester, in plain objects. */
export async function getTimetableData(): Promise<TimetableData> {
  const semester = await getCurrentSemester();
  const [venueRows, bookingRows, courseRows, lecturerRows, links] = await Promise.all([
    db.select().from(venues).orderBy(asc(venues.sortOrder), asc(venues.code)),
    semester ? db.select().from(bookings).where(eq(bookings.semesterId, semester.id)) : Promise.resolve([]),
    db.select().from(courses).orderBy(asc(courses.code)),
    db.select().from(lecturers).orderBy(asc(lecturers.name)),
    db.select().from(courseLecturers),
  ]);

  const byCourse = new Map<string, string[]>();
  for (const l of links) byCourse.set(l.courseCode, [...(byCourse.get(l.courseCode) ?? []), l.lecturerId]);

  return {
    semester: semester ? { id: semester.id, session: semester.session, name: semester.name } : null,
    venues: venueRows.map((v) => ({ code: v.code, name: v.name, seats: v.seats })),
    bookings: bookingRows.map((b) => ({
      id: b.id,
      venueCode: b.venueCode,
      day: b.day,
      start: b.start,
      span: b.span,
      label: b.label,
      kind: b.kind,
      note: b.note,
    })),
    courses: courseRows.map((c) => ({
      code: c.code,
      title: c.title,
      level: c.level,
      dept: c.dept,
      units: c.units,
      isCommon: c.isCommon,
      lecturerIds: byCourse.get(c.code) ?? [],
    })),
    lecturers: lecturerRows.map((l) => ({ id: l.id, name: l.name, dept: l.dept })),
  };
}

/** Builds the lookup the clash engine needs from loaded data. */
export function clashContext(data: TimetableData) {
  const courseMap = new Map<string, CourseInfo>(
    data.courses.map((c) => [
      c.code,
      { code: c.code, level: c.level, dept: c.dept, isCommon: c.isCommon, lecturerIds: c.lecturerIds },
    ]),
  );
  const names = new Map(data.lecturers.map((l) => [l.id, l.name]));
  return { courses: courseMap, lecturerName: (id: string) => names.get(id) };
}

export function clashesFor(data: TimetableData) {
  return findClashes(data.bookings, clashContext(data));
}
