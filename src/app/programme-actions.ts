"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lecturers, programmeCourses, programmeSlots, programmeTimetables, semesters } from "@/lib/db/schema";
import type { ProgrammeTimetable } from "@/lib/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { canManageProgrammeTimetable } from "@/lib/permissions";
import { logChange } from "@/lib/audit";
import { DEPARTMENTS, FACULTY_DEPTS, codesOf } from "@/lib/timetable";
import { PROGRAMMES, isProgramme, type Programme } from "@/lib/programmes";
import { WEEKDAYS, defaultTemplate, fits, timeRange, type CalendarRow, type Period, type VenueKeyItem } from "@/lib/programme";
import { validateSignoff, type Signoff } from "@/lib/signoff";
import type { ActionResult } from "@/lib/types";

type Result = ActionResult & { id?: number };
const fail = (error: string): Result => ({ ok: false, error });
function done(message?: string, id?: number): Result {
  revalidatePath("/", "layout");
  return { ok: true, message, id };
}

async function guard(fn: (me: CurrentUser) => Promise<Result>): Promise<Result> {
  try {
    const me = await getCurrentUser();
    if (!me) return fail("Your session has ended. Sign in again.");
    return await fn(me);
  } catch (err) {
    console.error(err);
    return fail("The change could not be saved. Check the database connection and try again.");
  }
}

const NOT_YOURS = "Only the Faculty Time-Table Officer or this department's officer can change this timetable.";
const nameOf = (t: Pick<ProgrammeTimetable, "programme" | "dept">) => `${isProgramme(t.programme) ? PROGRAMMES[t.programme].short : t.programme} (${t.dept})`;

async function loadMine(me: CurrentUser, id: number): Promise<{ ok: false; error: string } | { ok: true; t: ProgrammeTimetable }> {
  const [t] = await db.select().from(programmeTimetables).where(eq(programmeTimetables.id, id));
  if (!t) return { ok: false, error: "That timetable no longer exists." };
  if (!canManageProgrammeTimetable(me, t)) return { ok: false, error: NOT_YOURS };
  return { ok: true, t };
}

/* ---------- whole timetables ---------- */

export interface NewProgrammeInput {
  semesterId: number;
  programme: string;
  dept: string;
  /** Another timetable to copy (structure, classes and course list), or null for the usual template. */
  copyFrom: number | null;
}

function defaultTitle(programme: Programme, dept: string, sem: { name: string; session: string }) {
  const deptName = (DEPARTMENTS[dept] ?? dept).toUpperCase();
  const semName = sem.name.toUpperCase();
  if (programme === "pt") return `B.Sc. (${deptName}) PART-TIME ${semName} LECTURE TIME-TABLE FOR ${sem.session} ACADEMIC SESSION`;
  return `${PROGRAMMES[programme].short} COURSE ALLOCATION / ${semName} LECTURE TIME-TABLE FOR ${sem.session} SESSION`;
}

export async function createProgrammeTimetable(input: NewProgrammeInput): Promise<Result> {
  return guard(async (me) => {
    if (!isProgramme(input.programme) || input.programme === "ug") return fail("Choose part-time, M.Sc., Ph.D. or PGD.");
    const programme = input.programme;
    if (!(FACULTY_DEPTS as readonly string[]).includes(input.dept)) return fail("Choose the department.");
    if (!canManageProgrammeTimetable(me, { dept: input.dept })) return fail(`Only the Faculty Time-Table Officer or the ${input.dept} officer can start this timetable.`);
    const [sem] = await db.select().from(semesters).where(eq(semesters.id, input.semesterId));
    if (!sem) return fail("That semester no longer exists.");
    const [dup] = await db
      .select({ id: programmeTimetables.id })
      .from(programmeTimetables)
      .where(and(eq(programmeTimetables.semesterId, sem.id), eq(programmeTimetables.programme, programme), eq(programmeTimetables.dept, input.dept)));
    if (dup) return fail(`${sem.session} ${sem.name} already has a ${PROGRAMMES[programme].short} timetable for ${input.dept}.`);

    let src: ProgrammeTimetable | null = null;
    if (input.copyFrom) {
      [src] = await db.select().from(programmeTimetables).where(eq(programmeTimetables.id, input.copyFrom));
      if (!src) return fail("The timetable to copy no longer exists.");
      if (!canManageProgrammeTimetable(me, src)) return fail("You can only copy your own department's timetables.");
    }
    const base = src ?? { ...defaultTemplate(programme), signatoryName: "", signatoryRole: `Departmental Time-Table Officer, ${DEPARTMENTS[input.dept] ?? input.dept}` };
    const [t] = await db
      .insert(programmeTimetables)
      .values({
        semesterId: sem.id,
        programme,
        dept: input.dept,
        title: defaultTitle(programme, input.dept, sem),
        days: base.days,
        groups: base.groups,
        periods: base.periods,
        venueKey: base.venueKey,
        calendar: src ? src.calendar.map((c) => ({ ...c, dates: "" })) : base.calendar,
        notes: base.notes,
        signatoryName: base.signatoryName,
        signatoryRole: base.signatoryRole,
      })
      .returning();
    let copied = "";
    if (src) {
      const slots = await db.select().from(programmeSlots).where(eq(programmeSlots.timetableId, src.id));
      if (slots.length) await db.insert(programmeSlots).values(slots.map(({ id: _id, timetableId: _t, updatedAt: _u, ...s }) => ({ ...s, timetableId: t.id })));
      const cs = await db.select().from(programmeCourses).where(eq(programmeCourses.timetableId, src.id));
      if (cs.length) await db.insert(programmeCourses).values(cs.map(({ id: _id, timetableId: _t, ...c }) => ({ ...c, timetableId: t.id })));
      copied = ` copied from ${nameOf(src)} (${slots.length} classes, ${cs.length} courses)`;
    }
    await logChange(me, "prog.create", `Started the ${nameOf(t)} lecture timetable for ${sem.session} ${sem.name}${copied}.`, sem.id);
    return done("Timetable created.", t.id);
  });
}

export interface ProgrammeSetupInput {
  title: string;
  days: number[];
  groups: string[];
  periods: Period[];
  venueKey: VenueKeyItem[];
  calendar: CalendarRow[];
  notes: string[];
  signatoryName: string;
  signatoryRole: string;
}

export async function updateProgrammeSetup(id: number, input: ProgrammeSetupInput): Promise<Result> {
  return guard(async (me) => {
    const L = await loadMine(me, id);
    if (!L.ok) return fail(L.error);
    const t = L.t;
    const title = input.title.trim();
    if (!title || title.length > 220) return fail("Give the timetable a title (up to 220 characters).");
    const days = [...new Set(input.days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
    if (!days.length) return fail("Tick at least one lecture day.");
    const groups = input.groups.map((g) => g.trim().slice(0, 40));
    if (groups.length < 1 || groups.length > 12) return fail("Use 1 to 12 rows per day (e.g. YEAR 1 … YEAR 6). For a single class, leave one row with an empty name.");
    const periods = input.periods.map((p) => ({ label: p.label.trim().slice(0, 40), ...(p.isBreak ? { isBreak: true } : {}) }));
    if (periods.length < 1 || periods.length > 14 || periods.some((p) => !p.label)) return fail("Use 1 to 14 periods, each with its time, e.g. 8:00A.M. – 9:00A.M.");
    if (periods.every((p) => p.isBreak)) return fail("At least one period must be for lectures.");
    const venueKey = input.venueKey.map((v) => ({ code: v.code.trim().toUpperCase().slice(0, 6), name: v.name.trim().slice(0, 80) })).filter((v) => v.code);
    if (new Set(venueKey.map((v) => v.code)).size !== venueKey.length) return fail("Each venue letter can only be used once in the key.");
    const calendar = input.calendar.map((c) => ({ weeks: c.weeks.trim().slice(0, 20), dates: c.dates.trim().slice(0, 60), activity: c.activity.trim().slice(0, 120) })).filter((c) => c.weeks || c.dates || c.activity);
    const notes = input.notes.map((n) => n.trim().slice(0, 400)).filter(Boolean);

    const slots = await db.select().from(programmeSlots).where(eq(programmeSlots.timetableId, id));
    const stranded = slots.filter((s) => !days.includes(s.day) || s.group >= groups.length || !fits(periods, s.start, s.span));
    if (stranded.length)
      return fail(
        `Move or delete these first — they would no longer fit: ${stranded
          .slice(0, 5)
          .map((s) => `${s.label} (${WEEKDAYS[s.day]})`)
          .join(", ")}${stranded.length > 5 ? ` and ${stranded.length - 5} more` : ""}.`,
      );

    await db
      .update(programmeTimetables)
      .set({ title, days, groups, periods, venueKey, calendar, notes, signatoryName: input.signatoryName.trim().slice(0, 120), signatoryRole: input.signatoryRole.trim().slice(0, 160) })
      .where(eq(programmeTimetables.id, id));
    const changed: string[] = [];
    const diff = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
    if (t.title !== title) changed.push("title");
    if (diff(t.days, days)) changed.push(`days (${days.map((d) => WEEKDAYS[d]).join(", ")})`);
    if (diff(t.groups, groups)) changed.push("rows");
    if (diff(t.periods, periods)) changed.push("periods");
    if (diff(t.venueKey, venueKey)) changed.push("venue key");
    if (diff(t.calendar, calendar)) changed.push("calendar");
    if (diff(t.notes, notes)) changed.push("notes");
    if (t.signatoryName !== input.signatoryName.trim() || t.signatoryRole !== input.signatoryRole.trim()) changed.push("signatory");
    if (changed.length) await logChange(me, "prog.setup", `${nameOf(t)} lecture timetable: changed ${changed.join(", ")}.`, t.semesterId);
    return done("Set-up saved.");
  });
}

export async function setProgrammePublished(id: number, published: boolean): Promise<Result> {
  return guard(async (me) => {
    const L = await loadMine(me, id);
    if (!L.ok) return fail(L.error);
    await db.update(programmeTimetables).set({ isPublished: published, publishedAt: published ? new Date() : null }).where(eq(programmeTimetables.id, id));
    await logChange(me, "prog.publish", `${published ? "Published" : "Unpublished"} the ${nameOf(L.t)} lecture timetable.`, L.t.semesterId);
    return done(published ? "Published: students can now see this timetable." : "Unpublished: the public page no longer shows it.");
  });
}

export async function deleteProgrammeTimetable(id: number): Promise<Result> {
  return guard(async (me) => {
    const L = await loadMine(me, id);
    if (!L.ok) return fail(L.error);
    await db.delete(programmeTimetables).where(eq(programmeTimetables.id, id));
    await logChange(me, "prog.delete", `Deleted the ${nameOf(L.t)} lecture timetable.`, L.t.semesterId);
    return done("Timetable deleted.");
  });
}

export async function saveProgrammeSignoff(id: number, input: Signoff): Promise<ActionResult> {
  return guard(async (me) => {
    const L = await loadMine(me, id);
    if (!L.ok) return fail(L.error);
    const bad = validateSignoff(input);
    if (bad) return fail(bad);
    await db
      .update(programmeTimetables)
      .set({ signedOn: input.signedOn, signatureImage: input.image, signatureWidth: input.image ? input.width : null, signatureHeight: input.image ? input.height : null })
      .where(eq(programmeTimetables.id, id));
    await logChange(me, "prog.signoff", `Signed off the ${nameOf(L.t)} lecture timetable: dated ${input.signedOn ?? "—"}${input.image ? ", with signature" : ""}.`, L.t.semesterId);
    return done(input.image ? "Signature and date saved." : "Signing date saved.");
  });
}

export async function clearProgrammeSignoff(id: number): Promise<ActionResult> {
  return guard(async (me) => {
    const L = await loadMine(me, id);
    if (!L.ok) return fail(L.error);
    await db.update(programmeTimetables).set({ signedOn: null, signatureImage: null, signatureWidth: null, signatureHeight: null }).where(eq(programmeTimetables.id, id));
    await logChange(me, "prog.signoff", `Removed the sign-off for the ${nameOf(L.t)} lecture timetable.`, L.t.semesterId);
    return done("Sign-off removed.");
  });
}

/* ---------- classes on the grid ---------- */

export interface SlotInput {
  id?: string;
  timetableId: number;
  day: number;
  group: number;
  start: number;
  span: number;
  label: string;
  kind: "course" | "activity";
  venue: string;
  note: string;
}

const placeText = (t: ProgrammeTimetable, s: { day: number; group: number; start: number; span: number }) =>
  `${WEEKDAYS[s.day]}${t.groups[s.group] ? ` · ${t.groups[s.group]}` : ""}, ${timeRange(t.periods, s.start, s.span)}`;

function placeProblem(t: ProgrammeTimetable, s: { day: number; group: number; start: number; span: number }): string | null {
  if (!t.days.includes(s.day)) return "That day isn't on this timetable.";
  if (!Number.isInteger(s.group) || s.group < 0 || s.group >= Math.max(1, t.groups.length)) return "Pick one of the rows.";
  if (!fits(t.periods, s.start, s.span)) return "That would run into a break or past the last period. Shorten it or start earlier.";
  return null;
}

export async function saveProgrammeSlot(input: SlotInput): Promise<Result> {
  return guard(async (me) => {
    const L = await loadMine(me, input.timetableId);
    if (!L.ok) return fail(L.error);
    const t = L.t;
    const kind = input.kind === "activity" ? "activity" : "course";
    let label = input.label.trim().replace(/\s*\/\s*/g, "/");
    if (kind === "course") {
      label = label.toUpperCase().replace(/\s+/g, "");
      if (!label || codesOf(label).length !== label.split("/").length) return fail("Use course codes separated by “/”, e.g. COS101/CSC110. For FREE, PRACTICAL or TUTORIALS choose “Other”.");
    } else if (!label) return fail("Type what happens, e.g. PRACTICAL or TUTORIALS.");
    if (label.length > 60) return fail("That label is too long.");
    const values = { day: input.day, group: input.group, start: input.start, span: input.span, label, kind, venue: input.venue.trim().toUpperCase().slice(0, 6), note: input.note.trim().slice(0, 120), updatedAt: new Date() };
    const bad = placeProblem(t, values);
    if (bad) return fail(bad);
    if (input.id) {
      const [old] = await db.select().from(programmeSlots).where(and(eq(programmeSlots.id, input.id), eq(programmeSlots.timetableId, t.id)));
      if (!old) return fail("That class no longer exists. The page will refresh.");
      await db.update(programmeSlots).set(values).where(eq(programmeSlots.id, old.id));
      const a = `${old.label} (${placeText(t, old)})`;
      const b = `${label} (${placeText(t, values)})`;
      await logChange(me, "prog.slot.edit", `${nameOf(t)} lectures: ${a === b ? `edited ${b}` : `${a} → ${b}`}.`, t.semesterId);
      return done("Saved.");
    }
    await db.insert(programmeSlots).values({ ...values, timetableId: t.id });
    await logChange(me, "prog.slot.add", `${nameOf(t)} lectures: added ${label}${values.venue ? ` (${values.venue})` : ""} at ${placeText(t, values)}.`, t.semesterId);
    return done(`${label} added.`);
  });
}

export async function moveProgrammeSlot(id: string, day: number, group: number, start: number): Promise<Result> {
  return guard(async (me) => {
    const [s] = await db.select().from(programmeSlots).where(eq(programmeSlots.id, id));
    if (!s) return fail("That class no longer exists. The page will refresh.");
    const L = await loadMine(me, s.timetableId);
    if (!L.ok) return fail(L.error);
    const to = { day, group, start, span: s.span };
    const bad = placeProblem(L.t, to);
    if (bad) return fail(bad);
    await db.update(programmeSlots).set({ day, group, start, updatedAt: new Date() }).where(eq(programmeSlots.id, id));
    await logChange(me, "prog.slot.move", `${nameOf(L.t)} lectures: moved ${s.label} from ${placeText(L.t, s)} to ${placeText(L.t, to)}.`, L.t.semesterId);
    return done(`${s.label} moved to ${placeText(L.t, to)}.`);
  });
}

export async function deleteProgrammeSlot(id: string): Promise<Result> {
  return guard(async (me) => {
    const [s] = await db.select().from(programmeSlots).where(eq(programmeSlots.id, id));
    if (!s) return done("Deleted.");
    const L = await loadMine(me, s.timetableId);
    if (!L.ok) return fail(L.error);
    await db.delete(programmeSlots).where(eq(programmeSlots.id, id));
    await logChange(me, "prog.slot.delete", `${nameOf(L.t)} lectures: removed ${s.label} (${placeText(L.t, s)}).`, L.t.semesterId);
    return done(`${s.label} removed.`);
  });
}

/* ---------- course allocation list ---------- */

export interface AllocationInput {
  id?: string;
  timetableId: number;
  code: string;
  title: string;
  category: string;
  semester: number;
  lecturerIds: string[];
}

export async function saveProgrammeCourse(input: AllocationInput): Promise<Result> {
  return guard(async (me) => {
    const L = await loadMine(me, input.timetableId);
    if (!L.ok) return fail(L.error);
    const code = input.code.trim().toUpperCase().replace(/\s+/g, "");
    if (codesOf(code).length !== 1) return fail("Type one course code, e.g. CSC801.");
    const category = ["core", "mandatory", "elective"].includes(input.category) ? input.category : "";
    if (input.semester !== 1 && input.semester !== 2) return fail("Choose first or second semester.");
    const ids = [...new Set(input.lecturerIds)];
    if (ids.length) {
      const known = new Set((await db.select({ id: lecturers.id }).from(lecturers)).map((l) => l.id));
      if (ids.some((x) => !known.has(x))) return fail("One of the lecturers is no longer on the staff list. Refresh and try again.");
    }
    const values = { code, title: input.title.trim().slice(0, 120), category, semester: input.semester, lecturerIds: ids };
    const existing = await db.select().from(programmeCourses).where(eq(programmeCourses.timetableId, L.t.id));
    if (existing.some((c) => c.code === code && c.id !== input.id)) return fail(`${code} is already on the list.`);
    if (input.id) {
      if (!existing.some((c) => c.id === input.id)) return fail("That course is no longer on the list. The page will refresh.");
      await db.update(programmeCourses).set(values).where(eq(programmeCourses.id, input.id));
      await logChange(me, "prog.course", `${nameOf(L.t)} course list: edited ${code}.`, L.t.semesterId);
      return done(`${code} saved.`);
    }
    await db.insert(programmeCourses).values({ ...values, timetableId: L.t.id, sortOrder: existing.length });
    await logChange(me, "prog.course", `${nameOf(L.t)} course list: added ${code}${values.title ? ` ${values.title}` : ""}.`, L.t.semesterId);
    return done(`${code} added.`);
  });
}

export async function deleteProgrammeCourse(id: string): Promise<Result> {
  return guard(async (me) => {
    const [c] = await db.select().from(programmeCourses).where(eq(programmeCourses.id, id));
    if (!c) return done("Removed.");
    const L = await loadMine(me, c.timetableId);
    if (!L.ok) return fail(L.error);
    await db.delete(programmeCourses).where(eq(programmeCourses.id, id));
    await logChange(me, "prog.course", `${nameOf(L.t)} course list: removed ${c.code}.`, L.t.semesterId);
    return done(`${c.code} removed from the list.`);
  });
}

/** Moves a course up or down within its semester's list. */
export async function reorderProgrammeCourse(id: string, dir: -1 | 1): Promise<Result> {
  return guard(async (me) => {
    const [c] = await db.select().from(programmeCourses).where(eq(programmeCourses.id, id));
    if (!c) return fail("That course is no longer on the list.");
    const L = await loadMine(me, c.timetableId);
    if (!L.ok) return fail(L.error);
    const list = (await db.select().from(programmeCourses).where(and(eq(programmeCourses.timetableId, c.timetableId), eq(programmeCourses.semester, c.semester)))).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
    );
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return done();
    [list[i], list[j]] = [list[j], list[i]];
    for (let k = 0; k < list.length; k++) if (list[k].sortOrder !== k) await db.update(programmeCourses).set({ sortOrder: k }).where(eq(programmeCourses.id, list[k].id));
    return done();
  });
}
