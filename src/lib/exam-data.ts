import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import { bookings, courseLecturers, courses, examPapers, examTimetables, examUnavailability, lecturers, semesters, venues } from "./db/schema";
import type { ExamTimetable } from "./db/schema";
import { codesOf } from "./timetable";
import { PROGRAMME_ORDER, isProgramme } from "./programmes";
import { examIssues, type ExamCourseInfo } from "./exam";
import type { ExamBoardData, ExamPaperDTO, ExamTimetableDTO } from "./types";
import type { Signoff } from "./signoff";

export function toExamDTO(t: ExamTimetable): ExamTimetableDTO {
  return {
    id: t.id,
    semesterId: t.semesterId,
    programme: t.programme,
    dept: t.dept,
    title: t.title,
    sessions: t.sessions,
    dates: t.dates,
    notes: t.notes,
    signatoryName: t.signatoryName,
    signatoryRole: t.signatoryRole,
    isPublished: t.isPublished,
    signedOn: t.signedOn,
    hasSignature: !!t.signatureImage,
    invigilatorPool: t.invigilatorPool ?? null,
    assistantsPerPaper: t.assistantsPerPaper,
    maxDutiesPerDay: t.maxDutiesPerDay,
    invigilationPublished: t.invigilationPublished,
    invSignedOn: t.invSignedOn,
  };
}

const order = (t: { programme: string; dept: string | null }) => (isProgramme(t.programme) ? PROGRAMME_ORDER.indexOf(t.programme) : 99) * 100 + (t.dept ? 1 : 0);

/** Every exam timetable of a semester, with paper counts: undergraduate first, then by programme and department. */
export async function listExamTimetables(semesterId: number) {
  const rows = await db.select().from(examTimetables).where(eq(examTimetables.semesterId, semesterId));
  const papers = await db.select({ timetableId: examPapers.timetableId, kind: examPapers.kind }).from(examPapers);
  const count = new Map<number, number>();
  for (const p of papers) if (p.kind === "paper") count.set(p.timetableId, (count.get(p.timetableId) ?? 0) + 1);
  return rows
    .map((t) => ({ ...toExamDTO(t), paperCount: count.get(t.id) ?? 0 }))
    .sort((a, b) => order(a) - order(b) || (a.dept ?? "").localeCompare(b.dept ?? "") || a.id - b.id);
}

export async function getExamRow(id: number) {
  const [t] = await db.select().from(examTimetables).where(eq(examTimetables.id, id));
  return t ?? null;
}

export function examSignoff(t: ExamTimetable): Signoff {
  return { signedOn: t.signedOn, image: t.signatureImage, width: t.signatureWidth, height: t.signatureHeight };
}

/** Everything the exam screens need for one timetable. */
export async function getExamBoard(id: number): Promise<ExamBoardData | null> {
  const t = await getExamRow(id);
  if (!t) return null;
  const [semRows, paperRows, venueRows, courseRows, lecturerRows, links, lectureRows, offRows] = await Promise.all([
    db.select().from(semesters).where(eq(semesters.id, t.semesterId)),
    db.select().from(examPapers).where(eq(examPapers.timetableId, id)),
    db.select().from(venues).orderBy(asc(venues.sortOrder), asc(venues.code)),
    db.select().from(courses).orderBy(asc(courses.code)),
    db.select().from(lecturers).orderBy(asc(lecturers.name)),
    db.select().from(courseLecturers),
    t.programme === "ug"
      ? db.select({ label: bookings.label }).from(bookings).where(and(eq(bookings.semesterId, t.semesterId), eq(bookings.kind, "course")))
      : Promise.resolve([] as { label: string }[]),
    db.select().from(examUnavailability).where(eq(examUnavailability.timetableId, id)),
  ]);
  const sem = semRows[0];
  const byCourse = new Map<string, string[]>();
  for (const l of links) byCourse.set(l.courseCode, [...(byCourse.get(l.courseCode) ?? []), l.lecturerId]);

  return {
    semester: { id: sem.id, session: sem.session, name: sem.name, isPublished: sem.isPublished },
    timetable: toExamDTO(t),
    papers: paperRows.map(toPaperDTO),
    venues: venueRows.map((v) => ({ code: v.code, name: v.name, seats: v.seats, inLectureGrid: v.inLectureGrid })),
    courses: courseRows.map((c) => ({
      code: c.code,
      title: c.title,
      level: c.level,
      dept: c.dept,
      units: c.units,
      isCommon: c.isCommon,
      lecturerIds: byCourse.get(c.code) ?? [],
    })),
    lecturers: lecturerRows.map((l) => ({ id: l.id, name: l.name, dept: l.dept, shortName: l.shortName })),
    taughtCodes: [...new Set(lectureRows.flatMap((b) => codesOf(b.label)))].sort(),
    unavailable: offRows
      .map((u) => ({ id: u.id, lecturerId: u.lecturerId, date: u.date, session: u.session, reason: u.reason }))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.session ?? -1) - (b.session ?? -1)),
  };
}

export function toPaperDTO(p: typeof examPapers.$inferSelect): ExamPaperDTO {
  return {
    id: p.id,
    date: p.date,
    session: p.session,
    label: p.label,
    kind: p.kind === "block" ? "block" : "paper",
    venues: p.venues,
    year: p.year,
    note: p.note,
    chiefId: p.chiefId,
    invigilatorIds: p.invigilatorIds,
    assistantsNeeded: p.assistantsNeeded,
  };
}

/** The clash-check context for an exam board. */
export function examContext(data: Pick<ExamBoardData, "courses" | "lecturers">) {
  const m = new Map<string, ExamCourseInfo>(data.courses.map((c) => [c.code, { level: c.level, dept: c.dept, isCommon: c.isCommon }]));
  const names = new Map(data.lecturers.map((l) => [l.id, l.name]));
  return { course: (c: string) => m.get(c), lecturerName: (id: string) => names.get(id) };
}

export { resolvePool } from "./invigilation";

/** Published invigilation schedules (for the public look-up), newest semester first. */
export async function getReleasedInvigilation() {
  const rows = await db
    .select({ t: examTimetables, s: semesters })
    .from(examTimetables)
    .innerJoin(semesters, eq(semesters.id, examTimetables.semesterId))
    .where(eq(examTimetables.invigilationPublished, true));
  return rows
    .sort((a, b) => Number(b.s.isCurrent) - Number(a.s.isCurrent) || b.s.id - a.s.id || order(a.t) - order(b.t))
    .map((r) => ({ ...toExamDTO(r.t), semesterLabel: `${r.s.session} ${r.s.name}` }));
}

export function invigilationSignoff(t: ExamTimetable): Signoff {
  return { signedOn: t.invSignedOn, image: t.invSignatureImage, width: t.invSignatureWidth, height: t.invSignatureHeight };
}

export const examIssuesFor = (data: ExamBoardData) => examIssues(data.papers, examContext(data));

/** Published exam timetables (for the public page), newest semester first. */
export async function getPublishedExamTimetables() {
  const rows = await db
    .select({ t: examTimetables, s: semesters })
    .from(examTimetables)
    .innerJoin(semesters, eq(semesters.id, examTimetables.semesterId))
    .where(eq(examTimetables.isPublished, true));
  return rows
    .sort((a, b) => Number(b.s.isCurrent) - Number(a.s.isCurrent) || b.s.id - a.s.id || order(a.t) - order(b.t))
    .map((r) => ({ ...toExamDTO(r.t), semesterLabel: `${r.s.session} ${r.s.name}` }));
}
