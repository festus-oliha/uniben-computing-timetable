import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import { courseLecturers, lecturers, programmeCourses, programmeSlots, programmeTimetables, semesters } from "./db/schema";
import type { ProgrammeTimetable } from "./db/schema";
import { PROGRAMME_ORDER, isProgramme } from "./programmes";
import type { CourseCategory, PCourse, PSlot } from "./programme";
import type { Signoff } from "./signoff";
import type { ProgrammeBoardData, ProgrammeTimetableDTO } from "./types";

export function toProgrammeDTO(t: ProgrammeTimetable): ProgrammeTimetableDTO {
  return {
    id: t.id,
    semesterId: t.semesterId,
    programme: t.programme,
    dept: t.dept,
    title: t.title,
    days: t.days,
    groups: t.groups,
    periods: t.periods,
    venueKey: t.venueKey,
    calendar: t.calendar,
    notes: t.notes,
    signatoryName: t.signatoryName,
    signatoryRole: t.signatoryRole,
    isPublished: t.isPublished,
    signedOn: t.signedOn,
  };
}

const order = (t: { programme: string; dept: string }) => `${isProgramme(t.programme) ? PROGRAMME_ORDER.indexOf(t.programme) : 9}-${t.dept}`;

export async function listProgrammeTimetables(semesterId?: number) {
  const rows = await (semesterId
    ? db.select({ t: programmeTimetables, s: semesters }).from(programmeTimetables).innerJoin(semesters, eq(semesters.id, programmeTimetables.semesterId)).where(eq(programmeTimetables.semesterId, semesterId))
    : db.select({ t: programmeTimetables, s: semesters }).from(programmeTimetables).innerJoin(semesters, eq(semesters.id, programmeTimetables.semesterId)));
  const slots = await db.select({ timetableId: programmeSlots.timetableId, kind: programmeSlots.kind }).from(programmeSlots);
  const count = new Map<number, number>();
  for (const s of slots) if (s.kind === "course") count.set(s.timetableId, (count.get(s.timetableId) ?? 0) + 1);
  return rows
    .map((r) => ({ ...toProgrammeDTO(r.t), semesterLabel: `${r.s.session} ${r.s.name}`, classCount: count.get(r.t.id) ?? 0 }))
    .sort((a, b) => b.semesterId - a.semesterId || order(a).localeCompare(order(b)));
}

export async function getProgrammeRow(id: number) {
  const [t] = await db.select().from(programmeTimetables).where(eq(programmeTimetables.id, id));
  return t ?? null;
}

export const programmeSignoff = (t: ProgrammeTimetable): Signoff => ({ signedOn: t.signedOn, image: t.signatureImage, width: t.signatureWidth, height: t.signatureHeight });

export const toSlot = (s: typeof programmeSlots.$inferSelect): PSlot => ({
  id: s.id,
  day: s.day,
  group: s.group,
  start: s.start,
  span: s.span,
  label: s.label,
  kind: s.kind === "activity" ? "activity" : "course",
  venue: s.venue,
  note: s.note,
});

export const toPCourse = (c: typeof programmeCourses.$inferSelect): PCourse => ({
  id: c.id,
  code: c.code,
  title: c.title,
  category: (["core", "mandatory", "elective"].includes(c.category) ? c.category : "") as CourseCategory,
  semester: c.semester,
  lecturerIds: c.lecturerIds,
});

export async function getProgrammeBoard(id: number): Promise<ProgrammeBoardData | null> {
  const t = await getProgrammeRow(id);
  if (!t) return null;
  const [semRows, slotRows, courseRows, people, links] = await Promise.all([
    db.select().from(semesters).where(eq(semesters.id, t.semesterId)),
    db.select().from(programmeSlots).where(eq(programmeSlots.timetableId, id)),
    db.select().from(programmeCourses).where(eq(programmeCourses.timetableId, id)).orderBy(asc(programmeCourses.semester), asc(programmeCourses.sortOrder), asc(programmeCourses.code)),
    db.select().from(lecturers).orderBy(asc(lecturers.name)),
    db.select().from(courseLecturers),
  ]);
  const s = semRows[0];
  const cl: Record<string, string[]> = {};
  for (const l of links) (cl[l.courseCode] ??= []).push(l.lecturerId);
  return {
    semester: { id: s.id, session: s.session, name: s.name, isPublished: s.isPublished },
    timetable: toProgrammeDTO(t),
    slots: slotRows.map(toSlot),
    courses: courseRows.map(toPCourse),
    lecturers: people.map((l) => ({ id: l.id, name: l.name, dept: l.dept, shortName: l.shortName })),
    courseLecturers: cl,
  };
}

export async function getPublishedProgrammeTimetables() {
  return (await listProgrammeTimetables()).filter((t) => t.isPublished);
}
