"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseLecturers, examPapers, examTimetables, examUnavailability, lecturers } from "@/lib/db/schema";
import type { ExamTimetable } from "@/lib/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { canManageExamTimetable } from "@/lib/permissions";
import { logChange } from "@/lib/audit";
import { PROGRAMMES, isProgramme } from "@/lib/programmes";
import { dateLabel, isIsoDate } from "@/lib/exam";
import { eligibility, printName, suggestAssistants, type InvCtx, type InvPaper } from "@/lib/invigilation";
import { resolvePool } from "@/lib/exam-data";
import { validateSignoff, type Signoff } from "@/lib/signoff";
import type { ActionResult } from "@/lib/types";

const fail = (error: string): ActionResult => ({ ok: false, error });
function done(message?: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

const NOT_YOURS = "Only the time-table officer in charge of this examination timetable can change its invigilation.";

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

const nameOf = (t: Pick<ExamTimetable, "programme" | "dept">) => {
  const p = isProgramme(t.programme) ? PROGRAMMES[t.programme].short : t.programme;
  return t.dept ? `${p} (${t.dept})` : p;
};

/** Loads everything the invigilation rules need for one timetable. */
async function load(timetableId: number) {
  const [t] = await db.select().from(examTimetables).where(eq(examTimetables.id, timetableId));
  if (!t) return null;
  const [paperRows, people, links, off] = await Promise.all([
    db.select().from(examPapers).where(eq(examPapers.timetableId, timetableId)),
    db.select().from(lecturers),
    db.select().from(courseLecturers),
    db.select().from(examUnavailability).where(eq(examUnavailability.timetableId, timetableId)),
  ]);
  const byCourse = new Map<string, string[]>();
  for (const l of links) byCourse.set(l.courseCode, [...(byCourse.get(l.courseCode) ?? []), l.lecturerId]);
  const person = new Map(people.map((l) => [l.id, l]));
  const papers: InvPaper[] = paperRows.map((p) => ({ ...p, kind: p.kind === "block" ? "block" : "paper" }));
  const ctx: InvCtx = {
    lecturersOf: (c) => byCourse.get(c) ?? [],
    name: (id) => person.get(id)?.name ?? "Someone no longer on the staff list",
    unavailable: off,
    settings: { assistantsPerPaper: t.assistantsPerPaper, maxPerDay: t.maxDutiesPerDay, courseLecturersAssist: !["ug", "pt"].includes(t.programme) },
    sessionName: (s) => t.sessions[s]?.name ?? `session ${s + 1}`,
  };
  const short = (id: string) => (person.has(id) ? printName(person.get(id)!) : "?");
  return { t, papers, people, person, ctx, short };
}

const where = (p: { date: string; session: number }, t: ExamTimetable) =>
  `${dateLabel(p.date).day} ${dateLabel(p.date).date}, ${t.sessions[p.session]?.name ?? `session ${p.session + 1}`}`;

/* ---------- one paper ---------- */

export interface AssignInput {
  chiefId: string | null;
  invigilatorIds: string[];
  /** null = the timetable's usual number */
  assistantsNeeded: number | null;
}

/** Sets a paper's chief invigilator and assistants. The chief is always the officer's own choice. */
export async function assignInvigilators(paperId: string, input: AssignInput): Promise<ActionResult> {
  return guard(async (me) => {
    const [row] = await db.select().from(examPapers).where(eq(examPapers.id, paperId));
    if (!row) return fail("That paper no longer exists. The page will refresh.");
    const L = (await load(row.timetableId))!;
    if (!canManageExamTimetable(me, L.t)) return fail(NOT_YOURS);
    if (row.kind !== "paper") return fail("Whole-session blocks (GST, CED …) are invigilated by their own units.");
    const need = input.assistantsNeeded;
    if (need !== null && (!Number.isInteger(need) || need < 0 || need > 30)) return fail("Assistants needed must be a whole number from 0 to 30.");

    const chief = input.chiefId || null;
    const assistants = [...new Set(input.invigilatorIds)].filter((id) => id !== chief);
    for (const id of [chief, ...assistants]) if (id && !L.person.has(id)) return fail("One of the people chosen is no longer on the staff list. Refresh and try again.");

    const paper = L.papers.find((p) => p.id === paperId)!;
    const draft = { ...paper, chiefId: chief, invigilatorIds: assistants };
    const others = L.papers.filter((p) => p.id !== paperId);
    const problems: string[] = [];
    if (chief) {
      const e = eligibility(chief, "chief", draft, others, L.ctx);
      if (e.hard) problems.push(`${L.short(chief)} can't be chief: ${e.hard}`);
    }
    for (const id of assistants) {
      const e = eligibility(id, "assistant", draft, others, L.ctx);
      if (e.hard) problems.push(`${L.short(id)}: ${e.hard}`);
    }
    if (problems.length) return fail(`Not saved. ${problems.join("; ")}.`);

    await db.update(examPapers).set({ chiefId: chief, invigilatorIds: assistants, assistantsNeeded: need, updatedAt: new Date() }).where(eq(examPapers.id, paperId));
    const parts: string[] = [];
    if (row.chiefId !== chief) parts.push(chief ? `chief ${row.chiefId ? `${L.short(row.chiefId)} → ` : ""}${L.short(chief)}` : `removed chief ${L.short(row.chiefId!)}`);
    const added = assistants.filter((x) => !row.invigilatorIds.includes(x)).map(L.short);
    const removed = row.invigilatorIds.filter((x) => !assistants.includes(x)).map(L.short);
    if (added.length) parts.push(`added ${added.join(", ")}`);
    if (removed.length) parts.push(`removed ${removed.join(", ")}`);
    if (row.assistantsNeeded !== need) parts.push(`assistants needed ${need ?? `usual (${L.t.assistantsPerPaper})`}`);
    if (parts.length) await logChange(me, "inv.assign", `${nameOf(L.t)} invigilation, ${row.label} (${where(row, L.t)}): ${parts.join("; ")}.`, L.t.semesterId);
    return done("Invigilators saved.");
  });
}

/* ---------- whole schedule ---------- */

/** Suggests assistants for empty places only (all papers, or the ones given). Chiefs and existing assistants are kept. */
export async function fillAssistants(timetableId: number, paperIds?: string[]): Promise<ActionResult> {
  return guard(async (me) => {
    const L = await load(timetableId);
    if (!L) return fail("That timetable no longer exists.");
    if (!canManageExamTimetable(me, L.t)) return fail(NOT_YOURS);
    const pool = resolvePool(toPoolShape(L.t), L.people);
    if (!pool.length) return fail("Nobody is on the invigilators list yet. Add staff on the Lecturers tab, then choose who invigilates under Invigilators.");
    const changed = suggestAssistants(L.papers, pool, L.ctx, paperIds ? new Set(paperIds) : undefined);
    let added = 0;
    for (const [id, list] of changed) {
      added += list.length - (L.papers.find((p) => p.id === id)?.invigilatorIds.length ?? 0);
      await db.update(examPapers).set({ invigilatorIds: list, updatedAt: new Date() }).where(eq(examPapers.id, id));
    }
    if (!added) return done("Nothing to fill: every paper already has its assistants, or nobody suitable is free.");
    await logChange(me, "inv.suggest", `${nameOf(L.t)} invigilation: suggested ${added} assistant place${added === 1 ? "" : "s"} on ${changed.size} paper${changed.size === 1 ? "" : "s"}.`, L.t.semesterId);
    return done(`Suggested ${added} assistant${added === 1 ? "" : "s"} on ${changed.size} paper${changed.size === 1 ? "" : "s"}. Check them and adjust as needed.`);
  });
}

/** Removes the assistants from every paper (or one paper). Chiefs stay. */
export async function clearAssistants(timetableId: number, paperId?: string): Promise<ActionResult> {
  return guard(async (me) => {
    const L = await load(timetableId);
    if (!L) return fail("That timetable no longer exists.");
    if (!canManageExamTimetable(me, L.t)) return fail(NOT_YOURS);
    const targets = L.papers.filter((p) => (!paperId || p.id === paperId) && p.invigilatorIds.length);
    for (const p of targets) await db.update(examPapers).set({ invigilatorIds: [], updatedAt: new Date() }).where(eq(examPapers.id, p.id));
    if (targets.length)
      await logChange(me, "inv.clear", `${nameOf(L.t)} invigilation: cleared the assistants on ${paperId ? targets[0]?.label : `${targets.length} papers`} (chiefs kept).`, L.t.semesterId);
    return done(targets.length ? "Assistants cleared. Chief invigilators were kept." : "There were no assistants to clear.");
  });
}

/**
 * Hands one person's duties to someone else — on every paper, or from a date onwards.
 * Papers where the new person can't serve (busy, unavailable, or lectures the course when the duty is chief) are skipped and listed.
 */
export async function replaceInvigilator(timetableId: number, fromId: string, toId: string, fromDate: string | null): Promise<ActionResult> {
  return guard(async (me) => {
    const L = await load(timetableId);
    if (!L) return fail("That timetable no longer exists.");
    if (!canManageExamTimetable(me, L.t)) return fail(NOT_YOURS);
    if (!L.person.has(toId)) return fail("Choose who takes over the duties.");
    if (fromId === toId) return fail("Choose two different people.");
    if (fromDate && !isIsoDate(fromDate)) return fail("Pick a valid date.");
    const work = L.papers.map((p) => ({ ...p, invigilatorIds: [...p.invigilatorIds] }));
    const done_: string[] = [];
    const skipped: string[] = [];
    for (const p of work) {
      if (fromDate && p.date < fromDate) continue;
      const asChief = p.chiefId === fromId;
      const asAssistant = p.invigilatorIds.includes(fromId);
      if (!asChief && !asAssistant) continue;
      const draft = { ...p, chiefId: asChief ? null : p.chiefId, invigilatorIds: p.invigilatorIds.filter((x) => x !== fromId) };
      const e = eligibility(toId, asChief ? "chief" : "assistant", draft, work.filter((q) => q.id !== p.id), L.ctx);
      const already = draft.chiefId === toId || draft.invigilatorIds.includes(toId);
      if (e.hard || already) {
        skipped.push(`${p.label} (${already ? "already on it" : e.hard})`);
        continue;
      }
      if (asChief) p.chiefId = toId;
      else p.invigilatorIds = p.invigilatorIds.map((x) => (x === fromId ? toId : x));
      await db.update(examPapers).set({ chiefId: p.chiefId, invigilatorIds: p.invigilatorIds, updatedAt: new Date() }).where(eq(examPapers.id, p.id));
      done_.push(p.label);
    }
    if (!done_.length && !skipped.length) return fail(`${L.short(fromId)} has no duties${fromDate ? " from that date" : ""}.`);
    if (done_.length)
      await logChange(me, "inv.replace", `${nameOf(L.t)} invigilation: ${L.short(toId)} took over ${L.short(fromId)}'s duties on ${done_.join(", ")}${skipped.length ? `; not moved: ${skipped.join(", ")}` : ""}.`, L.t.semesterId);
    return skipped.length
      ? done(`${done_.length} dut${done_.length === 1 ? "y" : "ies"} handed over. Not moved — ${skipped.join("; ")}. Assign those by hand.`)
      : done(`${done_.length} dut${done_.length === 1 ? "y" : "ies"} handed over to ${L.short(toId)}.`);
  });
}

/* ---------- availability ---------- */

export interface UnavailableInput {
  lecturerId: string;
  dates: string[];
  session: number | null;
  reason: string;
  /** Also take them off any duties they already have then. */
  removeFromPapers: boolean;
}

export async function addUnavailability(timetableId: number, input: UnavailableInput): Promise<ActionResult> {
  return guard(async (me) => {
    const L = await load(timetableId);
    if (!L) return fail("That timetable no longer exists.");
    if (!canManageExamTimetable(me, L.t)) return fail(NOT_YOURS);
    if (!L.person.has(input.lecturerId)) return fail("Choose a person.");
    const dates = [...new Set(input.dates)].filter((d) => L.t.dates.includes(d)).sort();
    if (!dates.length) return fail("Choose at least one examination date.");
    if (input.session !== null && (!Number.isInteger(input.session) || input.session < 0 || input.session >= L.t.sessions.length)) return fail("Choose a session, or the whole day.");
    await db.insert(examUnavailability).values(dates.map((date) => ({ timetableId, lecturerId: input.lecturerId, date, session: input.session, reason: input.reason.trim().slice(0, 120) })));

    const hit = L.papers.filter((p) => dates.includes(p.date) && (input.session === null || p.session === input.session) && (p.chiefId === input.lecturerId || p.invigilatorIds.includes(input.lecturerId)));
    const needChief: string[] = [];
    if (input.removeFromPapers)
      for (const p of hit) {
        if (p.chiefId === input.lecturerId) needChief.push(p.label);
        await db
          .update(examPapers)
          .set({ chiefId: p.chiefId === input.lecturerId ? null : p.chiefId, invigilatorIds: p.invigilatorIds.filter((x) => x !== input.lecturerId), updatedAt: new Date() })
          .where(eq(examPapers.id, p.id));
      }
    const span = dates.length === 1 ? dateLabel(dates[0]).full : `${dates.length} dates`;
    await logChange(
      me,
      "inv.unavailable",
      `${nameOf(L.t)} invigilation: ${L.short(input.lecturerId)} unavailable on ${span}${input.session === null ? "" : ` (${L.t.sessions[input.session].name})`}${input.reason.trim() ? ` — ${input.reason.trim()}` : ""}${input.removeFromPapers && hit.length ? `; taken off ${hit.map((p) => p.label).join(", ")}` : ""}.`,
      L.t.semesterId,
    );
    if (!hit.length) return done("Saved. They had no duties then.");
    if (!input.removeFromPapers) return done(`Saved. They still have ${hit.length} dut${hit.length === 1 ? "y" : "ies"} then — shown as clashes until you change them.`);
    return done(
      `Saved and taken off ${hit.map((p) => p.label).join(", ")}.${needChief.length ? ` Choose a new chief for ${needChief.join(", ")}.` : ""} Use “Fill empty places” to replace the assistants.`,
    );
  });
}

export async function removeUnavailability(id: string): Promise<ActionResult> {
  return guard(async (me) => {
    const [u] = await db.select().from(examUnavailability).where(eq(examUnavailability.id, id));
    if (!u) return done("Removed.");
    const L = (await load(u.timetableId))!;
    if (!canManageExamTimetable(me, L.t)) return fail(NOT_YOURS);
    await db.delete(examUnavailability).where(eq(examUnavailability.id, id));
    await logChange(me, "inv.unavailable", `${nameOf(L.t)} invigilation: ${L.short(u.lecturerId)} available again on ${dateLabel(u.date).full}.`, L.t.semesterId);
    return done("Removed.");
  });
}

/* ---------- settings, release, sign-off ---------- */

const toPoolShape = (t: ExamTimetable) => ({ invigilatorPool: t.invigilatorPool ?? null, dept: t.dept });

export interface InvSettingsInput {
  assistantsPerPaper: number;
  maxDutiesPerDay: number;
  /** null = the usual list (the department's staff, or everyone for undergraduate) */
  pool: string[] | null;
}

export async function saveInvigilationSettings(timetableId: number, input: InvSettingsInput): Promise<ActionResult> {
  return guard(async (me) => {
    const L = await load(timetableId);
    if (!L) return fail("That timetable no longer exists.");
    if (!canManageExamTimetable(me, L.t)) return fail(NOT_YOURS);
    if (!Number.isInteger(input.assistantsPerPaper) || input.assistantsPerPaper < 0 || input.assistantsPerPaper > 30) return fail("Assistants per paper must be from 0 to 30.");
    if (!Number.isInteger(input.maxDutiesPerDay) || input.maxDutiesPerDay < 1 || input.maxDutiesPerDay > 6) return fail("Duties per day must be from 1 to 6.");
    const pool = input.pool ? [...new Set(input.pool)].filter((id) => L.person.has(id)) : null;
    await db
      .update(examTimetables)
      .set({ assistantsPerPaper: input.assistantsPerPaper, maxDutiesPerDay: input.maxDutiesPerDay, invigilatorPool: pool })
      .where(eq(examTimetables.id, timetableId));
    const parts: string[] = [];
    if (L.t.assistantsPerPaper !== input.assistantsPerPaper) parts.push(`assistants per paper ${L.t.assistantsPerPaper} → ${input.assistantsPerPaper}`);
    if (L.t.maxDutiesPerDay !== input.maxDutiesPerDay) parts.push(`duties a day ${L.t.maxDutiesPerDay} → ${input.maxDutiesPerDay}`);
    if (JSON.stringify(L.t.invigilatorPool ?? null) !== JSON.stringify(pool)) parts.push(pool ? `invigilators list (${pool.length} people)` : "invigilators list back to the usual");
    if (parts.length) await logChange(me, "inv.settings", `${nameOf(L.t)} invigilation: ${parts.join("; ")}.`, L.t.semesterId);
    return done("Invigilation settings saved.");
  });
}

export async function setInvigilationReleased(timetableId: number, released: boolean): Promise<ActionResult> {
  return guard(async (me) => {
    const [t] = await db.select().from(examTimetables).where(eq(examTimetables.id, timetableId));
    if (!t) return fail("That timetable no longer exists.");
    if (!canManageExamTimetable(me, t)) return fail(NOT_YOURS);
    await db.update(examTimetables).set({ invigilationPublished: released, invigilationPublishedAt: released ? new Date() : null }).where(eq(examTimetables.id, timetableId));
    await logChange(me, "inv.publish", `${released ? "Published" : "Unpublished"} the ${nameOf(t)} invigilation schedule.`, t.semesterId);
    return done(released ? "Published: invigilators can look up their duties." : "Unpublished: only signed-in staff can see it.");
  });
}

export async function saveInvigilationSignoff(timetableId: number, input: Signoff): Promise<ActionResult> {
  return guard(async (me) => {
    const [t] = await db.select().from(examTimetables).where(eq(examTimetables.id, timetableId));
    if (!t) return fail("That timetable no longer exists.");
    if (!canManageExamTimetable(me, t)) return fail(NOT_YOURS);
    const bad = validateSignoff(input);
    if (bad) return fail(bad);
    await db
      .update(examTimetables)
      .set({ invSignedOn: input.signedOn, invSignatureImage: input.image, invSignatureWidth: input.image ? input.width : null, invSignatureHeight: input.image ? input.height : null })
      .where(eq(examTimetables.id, timetableId));
    await logChange(me, "inv.signoff", `Signed off the ${nameOf(t)} invigilation schedule: dated ${input.signedOn ?? "—"}${input.image ? ", with signature" : ""}.`, t.semesterId);
    return done(input.image ? "Signature and date saved." : "Signing date saved.");
  });
}

export async function clearInvigilationSignoff(timetableId: number): Promise<ActionResult> {
  return guard(async (me) => {
    const [t] = await db.select().from(examTimetables).where(eq(examTimetables.id, timetableId));
    if (!t) return fail("That timetable no longer exists.");
    if (!canManageExamTimetable(me, t)) return fail(NOT_YOURS);
    await db.update(examTimetables).set({ invSignedOn: null, invSignatureImage: null, invSignatureWidth: null, invSignatureHeight: null }).where(eq(examTimetables.id, timetableId));
    await logChange(me, "inv.signoff", `Removed the sign-off for the ${nameOf(t)} invigilation schedule.`, t.semesterId);
    return done("Sign-off removed.");
  });
}
