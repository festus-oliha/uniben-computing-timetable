import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { courseLecturers, courses, lecturers, programmeCourses, programmeTimetables } from "./db/schema";
import { getCurrentSemester } from "./data";
import { PROGRAMMES, isProgramme } from "./programmes";
import { rankOrder } from "./staff";
import type { PublicStaffDTO, StaffDTO, TeachingDTO } from "./types";

type Row = typeof lecturers.$inferSelect;

const photoUrl = (l: Row) => (l.photo ? `/staff-photo/${l.id}?v=${l.updatedAt.getTime()}` : null);

export const toPublicStaff = (l: Row): PublicStaffDTO => ({
  id: l.id,
  name: l.name,
  dept: l.dept,
  category: l.category,
  rank: l.rank,
  position: l.position,
  qualifications: l.qualifications,
  interests: l.interests,
  bio: l.bio,
  photoUrl: photoUrl(l),
});

export const toStaff = (l: Row): StaffDTO => ({ ...toPublicStaff(l), shortName: l.shortName, staffNo: l.staffNo, email: l.email, phone: l.phone, office: l.office, isActive: l.isActive });

const CAT_ORDER: Record<string, number> = { academic: 0, technical: 1, administrative: 2 };
/** Department, then academic → technical → administrative, then seniority, then name. */
export const staffSort = (a: Row, b: Row) =>
  (a.dept ?? "~").localeCompare(b.dept ?? "~") ||
  (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9) ||
  rankOrder(a.rank) - rankOrder(b.rank) ||
  a.name.localeCompare(b.name);

export async function listStaffRows() {
  return (await db.select().from(lecturers)).sort(staffSort);
}

export async function getStaffRow(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [l] = await db.select().from(lecturers).where(eq(lecturers.id, id));
  return l ?? null;
}

/** Courses a staff member teaches this semester: undergraduate course list plus part-time / postgraduate allocations. */
export async function teachingOf(id: string): Promise<TeachingDTO[]> {
  const sem = await getCurrentSemester();
  const [ug, alloc] = await Promise.all([
    db.select({ code: courses.code, title: courses.title }).from(courseLecturers).innerJoin(courses, eq(courses.code, courseLecturers.courseCode)).where(eq(courseLecturers.lecturerId, id)),
    sem
      ? db
          .select({ c: programmeCourses, t: programmeTimetables })
          .from(programmeCourses)
          .innerJoin(programmeTimetables, eq(programmeTimetables.id, programmeCourses.timetableId))
          .where(eq(programmeTimetables.semesterId, sem.id))
      : Promise.resolve([]),
  ]);
  const out: TeachingDTO[] = ug.map((c) => ({ code: c.code, title: c.title ?? "", where: "Undergraduate" }));
  for (const r of alloc)
    if (r.c.lecturerIds.includes(id) && !out.some((o) => o.code === r.c.code))
      out.push({ code: r.c.code, title: r.c.title, where: `${isProgramme(r.t.programme) ? PROGRAMMES[r.t.programme].short : r.t.programme} (${r.t.dept})` });
  return out.sort((a, b) => a.code.localeCompare(b.code));
}
