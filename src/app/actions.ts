"use server";

import { revalidatePath } from "next/cache";
import { eq, ilike, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, courseLecturers, courses, lecturers, semesters, venues } from "@/lib/db/schema";
import { codesOf, fitsInBlock, isCourseCode, levelOf, prefixOf, type Kind } from "@/lib/timetable";
import { validateSignoff, type Signoff } from "@/lib/signoff";
import { getCurrentSemester } from "@/lib/data";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import {
  canChangeCourseScope,
  canEditBooking,
  canEditCourse,
  canManageLecturer,
  canSignOff,
  outsideDeptMessage,
  type DeptOf,
} from "@/lib/permissions";
import type { ActionResult } from "@/lib/types";
import { logChange, slotText } from "@/lib/audit";
import { KIND_LABELS, levelName } from "@/lib/timetable";

const KINDS: Kind[] = ["course", "activity", "pt", "shared"];

function done(message?: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

/** Runs an action for the signed-in person; anyone not signed in is refused. */
async function guard(fn: (me: CurrentUser) => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const me = await getCurrentUser();
    if (!me) return fail("Your session has ended. Sign in again.");
    return await fn(me);
  } catch (err) {
    console.error(err);
    return fail("The change could not be saved. Check the database connection and try again.");
  }
}

function validSlot(day: number, start: number, span: number): string | null {
  if (!Number.isInteger(day) || day < 0 || day > 4) return "Pick a day from Monday to Friday.";
  if (!Number.isInteger(span) || span < 1 || span > 4) return "A booking lasts 1 to 4 hours.";
  if (!fitsInBlock(start, span)) return "That booking would run past the 2:00 break or past 6:30 p.m.";
  return null;
}

async function venueExists(code: string) {
  const [v] = await db.select({ code: venues.code }).from(venues).where(eq(venues.code, code));
  return !!v;
}

/** Department lookup for the course codes in some labels, using the recorded department when there is one. */
async function deptLookup(...labels: string[]): Promise<DeptOf> {
  const codes = [...new Set(labels.flatMap(codesOf))];
  const rows = codes.length ? await db.select({ code: courses.code, dept: courses.dept }).from(courses).where(inArray(courses.code, codes)) : [];
  const m = new Map(rows.map((r) => [r.code, r.dept]));
  return (code) => m.get(code) ?? prefixOf(code);
}

/** Adds any course codes in a label that aren't on the course list yet. */
async function ensureCourses(label: string) {
  const codes = codesOf(label);
  if (!codes.length) return;
  await db
    .insert(courses)
    .values(codes.map((code) => ({ code, level: levelOf(code) ?? 1, dept: prefixOf(code) })))
    .onConflictDoNothing();
}

export async function moveBooking(id: string, venueCode: string, day: number, start: number): Promise<ActionResult> {
  return guard(async (me) => {
    const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
    if (!b) return fail("That booking no longer exists. The page will refresh.");
    if (!canEditBooking(me, b, await deptLookup(b.label))) return fail(outsideDeptMessage(me));
    const bad = validSlot(day, start, b.span);
    if (bad) return fail(bad);
    if (!(await venueExists(venueCode))) return fail(`Venue ${venueCode} doesn't exist.`);
    await db.update(bookings).set({ venueCode, day, start, updatedAt: new Date() }).where(eq(bookings.id, id));
    await logChange(me, "booking.move", `Moved ${b.label} from ${slotText(b)} to ${slotText({ venueCode, day, start, span: b.span })}.`, b.semesterId);
    return done(`${b.label} moved.`);
  });
}

export interface BookingInput {
  id?: string | null;
  semesterId: number;
  venueCode: string;
  day: number;
  start: number;
  span: number;
  label: string;
  kind: Kind;
  note: string;
}

export async function saveBooking(input: BookingInput): Promise<ActionResult> {
  return guard(async (me) => {
    const label = input.label.trim().replace(/\s*\/\s*/g, "/");
    if (!label) return fail("Type a course code or a label.");
    if (!KINDS.includes(input.kind)) return fail("Pick a booking type.");
    const bad = validSlot(input.day, input.start, input.span);
    if (bad) return fail(bad);
    if (!(await venueExists(input.venueCode))) return fail(`Venue ${input.venueCode} doesn't exist.`);
    if (input.kind === "course" && !codesOf(label).length)
      return fail("A course lecture needs a course code such as CSC301. For anything else, change the type.");

    const values = {
      venueCode: input.venueCode,
      day: input.day,
      start: input.start,
      span: input.span,
      label: input.kind === "course" ? label.toUpperCase() : label,
      kind: input.kind,
      note: input.note.trim(),
      updatedAt: new Date(),
    };
    const [existing] = input.id ? await db.select().from(bookings).where(eq(bookings.id, input.id)) : [];
    if (input.id && !existing) return fail("That booking no longer exists. The page will refresh.");
    const deptOf = await deptLookup(values.label, existing?.label ?? "");
    if ((existing && !canEditBooking(me, existing, deptOf)) || !canEditBooking(me, values, deptOf)) return fail(outsideDeptMessage(me));

    if (input.kind === "course") await ensureCourses(values.label);

    if (input.id) {
      await db.update(bookings).set(values).where(eq(bookings.id, input.id));
      const what = existing.label === values.label ? values.label : `${existing.label} → ${values.label}`;
      const where = slotText(existing) === slotText(values) ? slotText(values) : `${slotText(existing)} → ${slotText(values)}`;
      await logChange(me, "booking.edit", `Edited ${what} (${where}).`, existing.semesterId);
      return done("Booking saved.");
    }
    await db.insert(bookings).values({ ...values, semesterId: input.semesterId });
    await logChange(
      me,
      "booking.add",
      `Added ${values.label}${values.kind === "course" ? "" : ` (${KIND_LABELS[values.kind]})`} at ${slotText(values)}.`,
      input.semesterId,
    );
    return done("Booking added.");
  });
}

export async function deleteBooking(id: string): Promise<ActionResult> {
  return guard(async (me) => {
    const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
    if (!b) return done("Booking deleted.");
    if (!canEditBooking(me, b, await deptLookup(b.label))) return fail(outsideDeptMessage(me));
    await db.delete(bookings).where(eq(bookings.id, id));
    await logChange(me, "booking.delete", `Deleted ${b.label} from ${slotText(b)}.`, b.semesterId);
    return done("Booking deleted.");
  });
}

export interface CourseInput {
  code: string;
  level: number;
  dept: string;
  units: number | null;
  isCommon: boolean;
  lecturerId: string | null;
}

export async function saveCourse(input: CourseInput): Promise<ActionResult> {
  return guard(async (me) => {
    const code = input.code.trim().toUpperCase();
    if (!isCourseCode(code)) return fail("Course codes look like CSC305.");
    const [current] = await db.select().from(courses).where(eq(courses.code, code));
    if (!current) return fail(`${code} is not on the course list.`);
    if (!canEditCourse(me, current)) return fail(outsideDeptMessage(me));
    // Only the Faculty Officer changes a course's department or whether it is common.
    if (!canChangeCourseScope(me)) {
      input = { ...input, dept: current.dept, isCommon: current.isCommon };
    }
    if (!Number.isInteger(input.level) || input.level < 1 || input.level > 8) return fail("Pick a level from 100 to 800.");
    if (input.units != null && (!Number.isInteger(input.units) || input.units < 0 || input.units > 12))
      return fail("Units must be a whole number from 0 to 12.");

    await db
      .update(courses)
      .set({ level: input.level, dept: input.dept, units: input.units, isCommon: input.isCommon })
      .where(eq(courses.code, code));

    const [oldLink] = await db.select().from(courseLecturers).where(eq(courseLecturers.courseCode, code));
    await db.delete(courseLecturers).where(eq(courseLecturers.courseCode, code));
    if (input.lecturerId) await db.insert(courseLecturers).values({ courseCode: code, lecturerId: input.lecturerId });

    const changes: string[] = [];
    if (current.level !== input.level) changes.push(`level ${levelName(current.level)} → ${levelName(input.level)}`);
    if (current.dept !== input.dept) changes.push(`department ${current.dept} → ${input.dept}`);
    if (current.units !== input.units) changes.push(`units ${current.units ?? "—"} → ${input.units ?? "—"}`);
    if (current.isCommon !== input.isCommon) changes.push(input.isCommon ? "marked common" : "no longer common");
    if ((oldLink?.lecturerId ?? null) !== (input.lecturerId ?? null)) {
      const ids = [oldLink?.lecturerId, input.lecturerId].filter(Boolean) as string[];
      const names = new Map((ids.length ? await db.select().from(lecturers).where(inArray(lecturers.id, ids)) : []).map((l) => [l.id, l.name]));
      const n = (id?: string | null) => (id ? names.get(id) ?? "a removed lecturer" : "nobody");
      changes.push(`lecturer ${n(oldLink?.lecturerId)} → ${n(input.lecturerId)}`);
    }
    if (changes.length) await logChange(me, "course.edit", `${code}: ${changes.join("; ")}.`);
    return done(`${code} updated.`);
  });
}

export async function addCourse(rawCode: string): Promise<ActionResult> {
  return guard(async (me) => {
    const code = rawCode.trim().toUpperCase();
    if (!isCourseCode(code)) return fail("Type a course code like CSC305.");
    if (!canEditCourse(me, { code, dept: prefixOf(code) })) return fail(outsideDeptMessage(me));
    const [exists] = await db.select({ code: courses.code }).from(courses).where(eq(courses.code, code));
    if (exists) return fail(`${code} is already on the list.`);
    await db.insert(courses).values({ code, level: levelOf(code) ?? 1, dept: prefixOf(code) });
    await logChange(me, "course.add", `Added course ${code}.`);
    return done(`${code} added.`);
  });
}

/**
 * Removes a course from the course list (and its lecturer assignment).
 * Refused while the course still appears on any semester's timetable, so nothing is left pointing at it.
 */
export async function deleteCourse(rawCode: string): Promise<ActionResult> {
  return guard(async (me) => {
    const code = rawCode.trim().toUpperCase();
    const [current] = await db.select().from(courses).where(eq(courses.code, code));
    if (!current) return done(`${code} removed.`);
    if (!canEditCourse(me, current) || (current.isCommon && !canChangeCourseScope(me))) return fail(outsideDeptMessage(me));

    const candidates = await db
      .select({ b: bookings, session: semesters.session, semName: semesters.name })
      .from(bookings)
      .innerJoin(semesters, eq(semesters.id, bookings.semesterId))
      .where(ilike(bookings.label, `%${code}%`));
    const used = candidates.filter((r) => codesOf(r.b.label).includes(code));
    if (used.length) {
      const where = used
        .slice(0, 4)
        .map((r) => `${slotText(r.b)} (${r.session} ${r.semName})`)
        .join("; ");
      return fail(
        `${code} is still on the timetable in ${used.length} place${used.length > 1 ? "s" : ""}: ${where}${used.length > 4 ? " …" : ""}. Delete those bookings first, then delete the course.`,
      );
    }
    await db.delete(courses).where(eq(courses.code, code)); // lecturer links cascade
    await logChange(me, "course.delete", `Deleted course ${code} from the course list.`);
    return done(`${code} deleted.`);
  });
}

export async function addLecturer(name: string, dept: string): Promise<ActionResult> {
  return guard(async (me) => {
    const n = name.trim();
    if (!n) return fail("Type the lecturer's name.");
    const d = me.role === "dept_officer" ? me.dept : dept || null;
    if (!canManageLecturer(me, { dept: d })) return fail(outsideDeptMessage(me));
    await db.insert(lecturers).values({ name: n, dept: d });
    await logChange(me, "lecturer.add", `Added lecturer ${n}${d ? ` (${d})` : ""}.`);
    return done(`${n} added.`);
  });
}

export async function deleteLecturer(id: string): Promise<ActionResult> {
  return guard(async (me) => {
    const [l] = await db.select().from(lecturers).where(eq(lecturers.id, id));
    if (!l) return done("Lecturer removed.");
    if (!canManageLecturer(me, l)) return fail(outsideDeptMessage(me));
    await db.delete(lecturers).where(eq(lecturers.id, id)); // course links cascade
    await logChange(me, "lecturer.remove", `Removed lecturer ${l.name}.`);
    return done("Lecturer removed.");
  });
}

/**
 * Saves the Faculty Time-Table Officer's sign-off for the current semester.
 * The signing date and signature are printed on the Word and PDF exports.
 * Only the Faculty Time-Table Officer can sign.
 */
export async function saveSignoff(input: Signoff): Promise<ActionResult> {
  return guard(async (me) => {
    if (!canSignOff(me)) return fail("Only the Faculty Time-Table Officer can sign off the timetable.");
    const bad = validateSignoff(input);
    if (bad) return fail(bad);
    const sem = await getCurrentSemester();
    if (!sem) return fail("No semester has been set up yet.");
    await db
      .update(semesters)
      .set({
        signedOn: input.signedOn,
        signatureImage: input.image,
        signatureWidth: input.image ? input.width : null,
        signatureHeight: input.image ? input.height : null,
        signatureUpdatedAt: new Date(),
      })
      .where(eq(semesters.id, sem.id));
    await logChange(
      me,
      "signoff.save",
      `Signed off ${sem.session} ${sem.name}: dated ${input.signedOn ?? "—"}${input.image ? ", with signature" : ", no signature image"}.`,
      sem.id,
    );
    return done(input.image ? "Signature and date saved." : "Signing date saved.");
  });
}

export async function clearSignoff(): Promise<ActionResult> {
  return guard(async (me) => {
    if (!canSignOff(me)) return fail("Only the Faculty Time-Table Officer can sign off the timetable.");
    const sem = await getCurrentSemester();
    if (!sem) return fail("No semester has been set up yet.");
    await db
      .update(semesters)
      .set({ signedOn: null, signatureImage: null, signatureWidth: null, signatureHeight: null, signatureUpdatedAt: new Date() })
      .where(eq(semesters.id, sem.id));
    await logChange(me, "signoff.clear", `Removed the sign-off for ${sem.session} ${sem.name}.`, sem.id);
    return done("Sign-off removed. Exports now show a blank signature line.");
  });
}
