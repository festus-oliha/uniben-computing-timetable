"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses, examPapers, examTimetables, semesters, venues } from "@/lib/db/schema";
import type { ExamTimetable } from "@/lib/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { canAddExamPapers, canEditExamPaper, canManageExamTimetable, outsideDeptMessage, type DeptOf } from "@/lib/permissions";
import { logChange } from "@/lib/audit";
import { codesOf, DEPARTMENTS, FACULTY_DEPTS, levelOf, prefixOf } from "@/lib/timetable";
import { PROGRAMMES, defaultExamNotes, defaultExamSessions, isProgramme, type Programme } from "@/lib/programmes";
import { dateLabel, datesBetween, isIsoDate, paperText } from "@/lib/exam";
import { validateSignoff, type Signoff } from "@/lib/signoff";
import { DOCUMENT_TEXT } from "@/lib/export/document-text";
import type { ActionResult, ExamSessionDTO } from "@/lib/types";

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

const NOT_YOURS = "Only the Faculty Time-Table Officer (or this department's officer) can change this examination timetable.";

/** "Undergraduate" / "Part-time · Computer Science" — how a timetable is named in history and messages. */
function nameOf(t: Pick<ExamTimetable, "programme" | "dept">) {
  const p = isProgramme(t.programme) ? PROGRAMMES[t.programme].short : t.programme;
  return t.dept ? `${p} (${t.dept})` : p;
}

async function loadTimetable(id: number) {
  const [t] = await db.select().from(examTimetables).where(eq(examTimetables.id, id));
  return t ?? null;
}

async function deptLookup(...labels: string[]): Promise<DeptOf> {
  const codes = [...new Set(labels.flatMap(codesOf))];
  const rows = codes.length ? await db.select({ code: courses.code, dept: courses.dept }).from(courses).where(inArray(courses.code, codes)) : [];
  const m = new Map(rows.map((r) => [r.code, r.dept]));
  return (code) => m.get(code) ?? prefixOf(code);
}

function sessionsProblem(sessions: ExamSessionDTO[]): string | null {
  if (!Array.isArray(sessions) || sessions.length < 1 || sessions.length > 4) return "Use 1 to 4 sessions a day.";
  if (sessions.some((s) => !s.name.trim() || s.name.length > 40 || s.time.length > 40)) return "Give every session a name (and time) of up to 40 characters.";
  return null;
}

function datesProblem(dates: string[]): string | null {
  if (!Array.isArray(dates) || dates.length > 120) return "Use at most 120 examination dates.";
  if (dates.some((d) => !isIsoDate(d))) return "One of the dates isn't valid.";
  return null;
}

/* ---------- whole timetables ---------- */

export interface NewExamTimetableInput {
  semesterId: number;
  programme: string;
  dept: string | null;
  start: string;
  end: string;
  weekdays: number[];
}

export async function createExamTimetable(input: NewExamTimetableInput): Promise<Result> {
  return guard(async (me) => {
    if (!isProgramme(input.programme)) return fail("Choose a programme.");
    const programme: Programme = input.programme;
    const dept = PROGRAMMES[programme].deptScoped ? input.dept : null;
    if (PROGRAMMES[programme].deptScoped && (!dept || !(FACULTY_DEPTS as readonly string[]).includes(dept))) return fail("Choose the department this timetable is for.");
    if (!canManageExamTimetable(me, { dept })) return fail(dept ? `Only the Faculty Time-Table Officer or the ${dept} officer can start this timetable.` : "Only the Faculty Time-Table Officer can start the undergraduate examination timetable.");
    const [sem] = await db.select().from(semesters).where(eq(semesters.id, input.semesterId));
    if (!sem) return fail("That semester no longer exists.");
    if (!isIsoDate(input.start) || !isIsoDate(input.end)) return fail("Pick the first and last examination dates.");
    if (input.end < input.start) return fail("The last date is before the first date.");
    const dates = datesBetween(input.start, input.end, input.weekdays ?? []);
    if (!dates.length) return fail("No examination days fall in that range. Tick at least one weekday.");
    if (dates.length > 120) return fail("That range has too many days. Keep it under 120 examination days.");

    const existing = await db.select().from(examTimetables).where(eq(examTimetables.semesterId, sem.id));
    if (existing.some((t) => t.programme === programme && t.dept === dept))
      return fail(`${sem.session} ${sem.name} already has a ${nameOf({ programme, dept })} examination timetable.`);

    const prefix = programme === "ug" ? "" : programme === "pt" ? "PART-TIME " : `${PROGRAMMES[programme].short} `;
    const title = `${prefix}${sem.name.toUpperCase()} EXAMINATION TIMETABLE FOR THE ${sem.session} ACADEMIC SESSION`;
    const sign =
      programme === "ug"
        ? { signatoryName: DOCUMENT_TEXT.signatory.name, signatoryRole: DOCUMENT_TEXT.signatory.role }
        : { signatoryName: "", signatoryRole: `Departmental Time-Table Officer, ${DEPARTMENTS[dept!] ?? dept}` };

    const [t] = await db
      .insert(examTimetables)
      .values({ semesterId: sem.id, programme, dept, title, sessions: defaultExamSessions(programme), dates, notes: defaultExamNotes(programme), ...sign })
      .returning();
    await logChange(me, "exam.create", `Started the ${nameOf(t)} examination timetable (${dates.length} days, ${dateLabel(dates[0]).full} – ${dateLabel(dates.at(-1)!).full}).`, sem.id);
    return done("Examination timetable created.", t.id);
  });
}

export interface ExamSetupInput {
  title: string;
  sessions: ExamSessionDTO[];
  dates: string[];
  notes: string[];
  signatoryName: string;
  signatoryRole: string;
}

export async function updateExamSetup(id: number, input: ExamSetupInput): Promise<Result> {
  return guard(async (me) => {
    const t = await loadTimetable(id);
    if (!t) return fail("That timetable no longer exists.");
    if (!canManageExamTimetable(me, t)) return fail(NOT_YOURS);
    const title = input.title.trim();
    if (!title || title.length > 200) return fail("Give the timetable a title (up to 200 characters).");
    const sessions = input.sessions.map((s) => ({ name: s.name.trim(), time: s.time.trim() }));
    const bad = sessionsProblem(sessions) ?? datesProblem(input.dates);
    if (bad) return fail(bad);
    const dates = [...new Set(input.dates)].sort();
    const notes = input.notes.map((n) => n.trim()).filter(Boolean);
    if (notes.length > 30 || notes.some((n) => n.length > 600)) return fail("Use at most 30 notes of up to 600 characters each.");

    const papers = await db.select().from(examPapers).where(eq(examPapers.timetableId, id));
    const stranded = papers.filter((p) => !dates.includes(p.date) || p.session >= sessions.length);
    if (stranded.length)
      return fail(
        `Move or delete these first — their date or session would be removed: ${stranded
          .slice(0, 5)
          .map((p) => `${p.label} (${dateLabel(p.date).day} ${dateLabel(p.date).date})`)
          .join(", ")}${stranded.length > 5 ? ` and ${stranded.length - 5} more` : ""}.`,
      );

    await db
      .update(examTimetables)
      .set({ title, sessions, dates, notes, signatoryName: input.signatoryName.trim().slice(0, 120), signatoryRole: input.signatoryRole.trim().slice(0, 160) })
      .where(eq(examTimetables.id, id));
    const changes: string[] = [];
    if (t.title !== title) changes.push("title");
    if (JSON.stringify(t.sessions) !== JSON.stringify(sessions)) changes.push(`sessions (${sessions.length} a day)`);
    if (JSON.stringify(t.dates) !== JSON.stringify(dates)) changes.push(`dates (${dates.length})`);
    if (JSON.stringify(t.notes) !== JSON.stringify(notes)) changes.push("notes");
    if (t.signatoryName !== input.signatoryName.trim() || t.signatoryRole !== input.signatoryRole.trim()) changes.push("signatory");
    if (changes.length) await logChange(me, "exam.setup", `${nameOf(t)} examination timetable: changed ${changes.join(", ")}.`, t.semesterId);
    return done("Timetable set-up saved.");
  });
}

export async function setExamPublished(id: number, published: boolean): Promise<Result> {
  return guard(async (me) => {
    const t = await loadTimetable(id);
    if (!t) return fail("That timetable no longer exists.");
    if (!canManageExamTimetable(me, t)) return fail(NOT_YOURS);
    await db.update(examTimetables).set({ isPublished: published, publishedAt: published ? new Date() : null }).where(eq(examTimetables.id, id));
    await logChange(me, "exam.publish", `${published ? "Published" : "Unpublished"} the ${nameOf(t)} examination timetable.`, t.semesterId);
    return done(published ? "Published: students can now see this examination timetable." : "Unpublished: the public page no longer shows it.");
  });
}

export async function deleteExamTimetable(id: number): Promise<Result> {
  return guard(async (me) => {
    const t = await loadTimetable(id);
    if (!t) return done("Timetable deleted.");
    if (!canManageExamTimetable(me, t)) return fail(NOT_YOURS);
    const n = (await db.select({ id: examPapers.id }).from(examPapers).where(eq(examPapers.timetableId, id))).length;
    await db.delete(examTimetables).where(eq(examTimetables.id, id));
    await logChange(me, "exam.delete", `Deleted the ${nameOf(t)} examination timetable${n ? ` and its ${n} entries` : ""}.`, t.semesterId);
    return done("Timetable deleted.");
  });
}

export async function saveExamSignoff(id: number, input: Signoff): Promise<ActionResult> {
  return guard(async (me) => {
    const t = await loadTimetable(id);
    if (!t) return fail("That timetable no longer exists.");
    if (!canManageExamTimetable(me, t)) return fail(NOT_YOURS);
    const bad = validateSignoff(input);
    if (bad) return fail(bad);
    await db
      .update(examTimetables)
      .set({ signedOn: input.signedOn, signatureImage: input.image, signatureWidth: input.image ? input.width : null, signatureHeight: input.image ? input.height : null })
      .where(eq(examTimetables.id, id));
    await logChange(me, "exam.signoff", `Signed off the ${nameOf(t)} examination timetable: dated ${input.signedOn ?? "—"}${input.image ? ", with signature" : ""}.`, t.semesterId);
    return done(input.image ? "Signature and date saved." : "Signing date saved.");
  });
}

export async function clearExamSignoff(id: number): Promise<ActionResult> {
  return guard(async (me) => {
    const t = await loadTimetable(id);
    if (!t) return fail("That timetable no longer exists.");
    if (!canManageExamTimetable(me, t)) return fail(NOT_YOURS);
    await db.update(examTimetables).set({ signedOn: null, signatureImage: null, signatureWidth: null, signatureHeight: null }).where(eq(examTimetables.id, id));
    await logChange(me, "exam.signoff", `Removed the sign-off for the ${nameOf(t)} examination timetable.`, t.semesterId);
    return done("Sign-off removed.");
  });
}

/* ---------- papers ---------- */

export interface ExamPaperInput {
  id?: string;
  timetableId: number;
  date: string;
  session: number;
  label: string;
  kind: "paper" | "block";
  venues: string[];
  year: string | null;
  note: string;
}

const where = (p: { date: string; session: number }, t: ExamTimetable) =>
  `${dateLabel(p.date).day} ${dateLabel(p.date).date}, ${t.sessions[p.session]?.name ?? `session ${p.session + 1}`}`;

function slotProblem(t: ExamTimetable, date: string, session: number): string | null {
  if (!t.dates.includes(date)) return "That date is not on this timetable. Add it under Set-up first.";
  if (!Number.isInteger(session) || session < 0 || session >= t.sessions.length) return "Pick one of the sessions.";
  return null;
}

export async function saveExamPaper(input: ExamPaperInput): Promise<Result> {
  return guard(async (me) => {
    const t = await loadTimetable(input.timetableId);
    if (!t) return fail("That timetable no longer exists.");
    if (!canAddExamPapers(me, t)) return fail(outsideDeptMessage(me));
    const kind: "paper" | "block" = input.kind === "block" ? "block" : "paper";
    let label = input.label.trim().replace(/\s*\/\s*/g, "/");
    if (kind === "paper") label = label.toUpperCase().replace(/\s+/g, "");
    if (!label || label.length > 60) return fail(kind === "paper" ? "Type the course code, e.g. CSC313 or CSC313/CSC301." : "Name the block, e.g. GST.");
    if (kind === "paper" && codesOf(label).length !== label.split("/").length)
      return fail("Use course codes separated by “/”, e.g. CSC313/CSC301. For GST or CED sessions, choose “Whole-session block”.");
    const bad = slotProblem(t, input.date, input.session);
    if (bad) return fail(bad);
    const vs = [...new Set(input.venues.map((v) => v.trim().toUpperCase()).filter(Boolean))];
    if (vs.length > 12) return fail("Use at most 12 venues for one paper.");
    if (vs.length) {
      const known = new Set((await db.select({ code: venues.code }).from(venues).where(inArray(venues.code, vs))).map((v) => v.code));
      const unknown = vs.filter((v) => !known.has(v));
      if (unknown.length) return fail(`Unknown venue${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. Add ${unknown.length > 1 ? "them" : "it"} under Settings → Venues first.`);
    }
    const year = input.year?.trim().toUpperCase() || null;
    if (year && !/^Y[1-7]$/.test(year)) return fail("Year groups are Y1 to Y7.");

    const values = { date: input.date, session: input.session, label, kind, venues: kind === "block" ? [] : vs, year: kind === "block" ? null : year, note: input.note.trim().slice(0, 200), updatedAt: new Date() };
    const [existing] = input.id ? await db.select().from(examPapers).where(and(eq(examPapers.id, input.id), eq(examPapers.timetableId, t.id))) : [];
    if (input.id && !existing) return fail("That entry no longer exists. The page will refresh.");
    const deptOf = await deptLookup(label, existing?.label ?? "");
    if ((existing && !canEditExamPaper(me, t, existing, deptOf)) || !canEditExamPaper(me, t, values, deptOf)) return fail(outsideDeptMessage(me));

    if (kind === "paper" && t.programme === "ug")
      await db.insert(courses).values(codesOf(label).map((code) => ({ code, level: levelOf(code) ?? 1, dept: prefixOf(code) }))).onConflictDoNothing();

    if (existing) {
      await db.update(examPapers).set(values).where(eq(examPapers.id, existing.id));
      const before = `${paperText({ ...existing, kind: existing.kind as "paper" | "block" })} at ${where(existing, t)}`;
      const after = `${paperText(values)} at ${where(values, t)}`;
      await logChange(me, "exam.paper.edit", `${nameOf(t)} exams: ${before === after ? `edited ${after}` : `${before} → ${after}`}.`, t.semesterId);
      return done("Saved.");
    }
    await db.insert(examPapers).values({ ...values, timetableId: t.id });
    await logChange(me, "exam.paper.add", `${nameOf(t)} exams: added ${paperText(values)} at ${where(values, t)}.`, t.semesterId);
    return done(kind === "paper" ? "Paper added." : "Block added.");
  });
}

export async function moveExamPaper(id: string, date: string, session: number): Promise<Result> {
  return guard(async (me) => {
    const [p] = await db.select().from(examPapers).where(eq(examPapers.id, id));
    if (!p) return fail("That entry no longer exists. The page will refresh.");
    const t = (await loadTimetable(p.timetableId))!;
    if (!canEditExamPaper(me, t, p, await deptLookup(p.label))) return fail(outsideDeptMessage(me));
    const bad = slotProblem(t, date, session);
    if (bad) return fail(bad);
    if (p.date === date && p.session === session) return done();
    await db.update(examPapers).set({ date, session, updatedAt: new Date() }).where(eq(examPapers.id, id));
    await logChange(me, "exam.paper.move", `${nameOf(t)} exams: moved ${p.label} from ${where(p, t)} to ${where({ date, session }, t)}.`, t.semesterId);
    return done(`${p.label} moved to ${where({ date, session }, t)}.`);
  });
}

export async function deleteExamPaper(id: string): Promise<Result> {
  return guard(async (me) => {
    const [p] = await db.select().from(examPapers).where(eq(examPapers.id, id));
    if (!p) return done("Deleted.");
    const t = (await loadTimetable(p.timetableId))!;
    if (!canEditExamPaper(me, t, p, await deptLookup(p.label))) return fail(outsideDeptMessage(me));
    await db.delete(examPapers).where(eq(examPapers.id, id));
    await logChange(me, "exam.paper.delete", `${nameOf(t)} exams: removed ${p.label} from ${where(p, t)}.`, t.semesterId);
    return done(`${p.label} removed.`);
  });
}
