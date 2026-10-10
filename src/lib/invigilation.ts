/**
 * Invigilation rules — pure functions, tested in invigilation.test.ts.
 *
 * - The chief invigilator is always chosen by the time-table officer in charge; the app never fills it in.
 * - A lecturer of a course in the paper can never be that paper's chief invigilator.
 * - The app may suggest assistants: it only fills empty places and never replaces anyone already assigned.
 */
import { codesOf } from "./timetable";
import { dateLabel, type PaperLike } from "./exam";

export interface InvPaper extends PaperLike {
  /** Assistants this paper needs; null = the timetable's usual number. */
  assistantsNeeded: number | null;
}

export interface Unavailable {
  lecturerId: string;
  date: string;
  /** null = the whole day */
  session: number | null;
  reason?: string;
}

export interface InvSettings {
  assistantsPerPaper: number;
  /** More duties than this on one day is flagged (and never suggested). */
  maxPerDay: number;
  /** Postgraduate: course lecturers invigilate their own papers (as assistants), so suggest them first. */
  courseLecturersAssist?: boolean;
}

export interface InvCtx {
  /** Lecturers of a course code. */
  lecturersOf: (code: string) => readonly string[];
  name: (id: string) => string;
  unavailable: readonly Unavailable[];
  settings: InvSettings;
  sessionName?: (session: number) => string;
}

export interface InvIssue {
  type: "ownCourse" | "busy" | "unavailable" | "twice" | "noChief" | "short" | "overDay";
  severity: "error" | "warning";
  paperIds: string[];
  lecturerId?: string;
  message: string;
}

const TITLES = /^(prof|professor|dr|mr|mrs|ms|miss|engr|rev|revd|arc|barr|pharm|sir|chief|hon)\.?$/i;

/** "Dr. P. O. Egwali" → "EGWALI"; "Egwali, P. O." → "EGWALI"; "Prof. (Mrs.) F. Imianvan" → "IMIANVAN". */
export function shortNameOf(name: string): string {
  const s = name.trim();
  if (!s) return "";
  if (s.includes(",")) return s.split(",")[0].replace(/[^\p{L}\p{N}' -]/gu, "").trim().toUpperCase();
  const words = s
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !TITLES.test(w) && !/^\p{L}\.?$/u.test(w) && !/^(\p{L}\.)+$/u.test(w));
  return (words.at(-1) ?? s).replace(/[^\p{L}\p{N}'-]/gu, "").toUpperCase();
}

/** The name printed on the schedule: the lecturer's own print name if set, else the surname in capitals. */
export const printName = (l: { name: string; shortName?: string | null }) => l.shortName?.trim() || shortNameOf(l.name);

/** Lecturers who teach any course in the paper. */
export function courseLecturers(p: Pick<PaperLike, "label" | "kind">, ctx: Pick<InvCtx, "lecturersOf">): Set<string> {
  if (p.kind !== "paper") return new Set();
  return new Set(codesOf(p.label).flatMap((c) => ctx.lecturersOf(c)));
}

export const needed = (p: InvPaper, s: InvSettings) => (p.kind === "paper" ? (p.assistantsNeeded ?? s.assistantsPerPaper) : 0);

export const peopleOn = (p: Pick<PaperLike, "chiefId" | "invigilatorIds">) => [p.chiefId, ...p.invigilatorIds].filter((x): x is string => !!x);

export function unavailableFor(id: string, date: string, session: number, list: readonly Unavailable[]) {
  return list.find((u) => u.lecturerId === id && u.date === date && (u.session === null || u.session === session));
}

const when = (p: PaperLike, ctx?: Pick<InvCtx, "sessionName">) => {
  const d = dateLabel(p.date);
  return `${d.day} ${d.date}, ${ctx?.sessionName?.(p.session) ?? `session ${p.session + 1}`}`;
};

/** Every duty each person has: how many as chief and as assistant, and per day. */
export function dutyCounts(papers: readonly PaperLike[]) {
  const m = new Map<string, { chief: number; assistant: number; total: number; byDate: Map<string, number> }>();
  const get = (id: string) => {
    let r = m.get(id);
    if (!r) m.set(id, (r = { chief: 0, assistant: 0, total: 0, byDate: new Map() }));
    return r;
  };
  for (const p of papers) {
    if (p.chiefId) {
      const r = get(p.chiefId);
      r.chief++;
      r.total++;
      r.byDate.set(p.date, (r.byDate.get(p.date) ?? 0) + 1);
    }
    for (const id of new Set(p.invigilatorIds)) {
      if (id === p.chiefId) continue;
      const r = get(id);
      r.assistant++;
      r.total++;
      r.byDate.set(p.date, (r.byDate.get(p.date) ?? 0) + 1);
    }
  }
  return m;
}

/**
 * Can this person take this role on this paper?
 * hard: a reason they cannot (refused on save). soft: a reason to think twice (allowed, flagged).
 */
export function eligibility(
  id: string,
  role: "chief" | "assistant",
  paper: InvPaper,
  papers: readonly InvPaper[],
  ctx: InvCtx,
): { hard: string | null; soft: string | null } {
  if (role === "chief" && courseLecturers(paper, ctx).has(id)) return { hard: `lectures ${paper.label}`, soft: null };
  const off = unavailableFor(id, paper.date, paper.session, ctx.unavailable);
  if (off) return { hard: `unavailable${off.reason ? ` (${off.reason})` : ""}`, soft: null };
  const clash = papers.find((q) => q.id !== paper.id && q.date === paper.date && q.session === paper.session && peopleOn(q).includes(id));
  if (clash) return { hard: `already on ${clash.label} in this session`, soft: null };
  const sameDay = papers.filter((q) => q.id !== paper.id && q.date === paper.date && peopleOn(q).includes(id)).length;
  if (sameDay >= ctx.settings.maxPerDay) return { hard: null, soft: `already ${sameDay} dut${sameDay === 1 ? "y" : "ies"} that day` };
  return { hard: null, soft: null };
}

/** Everything wrong or missing in an invigilation schedule. */
export function invigilationIssues(papers: readonly InvPaper[], ctx: InvCtx): InvIssue[] {
  const out: InvIssue[] = [];
  const list = papers.filter((p) => p.kind === "paper");
  for (const p of list) {
    const lec = courseLecturers(p, ctx);
    if (p.chiefId && lec.has(p.chiefId))
      out.push({ type: "ownCourse", severity: "error", paperIds: [p.id], lecturerId: p.chiefId, message: `${ctx.name(p.chiefId)} lectures ${p.label} and cannot be its chief invigilator.` });
    const ids = peopleOn(p);
    const dup = ids.find((x, i) => ids.indexOf(x) !== i);
    if (dup) out.push({ type: "twice", severity: "error", paperIds: [p.id], lecturerId: dup, message: `${ctx.name(dup)} is listed twice on ${p.label}.` });
    for (const id of new Set(ids)) {
      const off = unavailableFor(id, p.date, p.session, ctx.unavailable);
      if (off) out.push({ type: "unavailable", severity: "error", paperIds: [p.id], lecturerId: id, message: `${ctx.name(id)} is unavailable on ${when(p, ctx)}${off.reason ? ` (${off.reason})` : ""} but is on ${p.label}.` });
    }
    if (!p.chiefId) out.push({ type: "noChief", severity: "warning", paperIds: [p.id], message: `${p.label} (${when(p, ctx)}) has no chief invigilator yet.` });
    const need = needed(p, ctx.settings);
    const have = new Set(p.invigilatorIds.filter((x) => x !== p.chiefId)).size;
    if (have < need) out.push({ type: "short", severity: "warning", paperIds: [p.id], message: `${p.label} (${when(p, ctx)}) needs ${need} assistant${need === 1 ? "" : "s"}; ${have} assigned.` });
  }

  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.date !== b.date || a.session !== b.session) continue;
      const bs = new Set(peopleOn(b));
      for (const id of new Set(peopleOn(a)))
        if (bs.has(id)) out.push({ type: "busy", severity: "error", paperIds: [a.id, b.id], lecturerId: id, message: `${ctx.name(id)} is on both ${a.label} and ${b.label} (${when(a, ctx)}).` });
    }

  for (const [id, r] of dutyCounts(list))
    for (const [date, n] of r.byDate)
      if (n > ctx.settings.maxPerDay) {
        const ps = list.filter((p) => p.date === date && peopleOn(p).includes(id));
        out.push({ type: "overDay", severity: "warning", paperIds: ps.map((p) => p.id), lecturerId: id, message: `${ctx.name(id)} has ${n} duties on ${dateLabel(date).day} ${dateLabel(date).date} (limit ${ctx.settings.maxPerDay}).` });
      }
  return out;
}

/**
 * Suggests assistants for the empty places only — nobody already assigned is moved or removed, and chiefs are
 * never chosen. Picks the people with the fewest duties so far, skipping anyone unavailable, already busy in
 * that session, or at the day's limit. Postgraduate papers take their own course lecturers first; other papers
 * use a course's own lecturer only when nobody else is free.
 * Returns the new assistant list for each paper that changed.
 */
export function suggestAssistants(papers: readonly InvPaper[], pool: readonly string[], ctx: InvCtx, onlyPaperIds?: ReadonlySet<string>): Map<string, string[]> {
  const work = papers.map((p) => ({ ...p, invigilatorIds: [...p.invigilatorIds] }));
  const counts = dutyCounts(work);
  const total = (id: string) => counts.get(id)?.total ?? 0;
  const onDay = (id: string, date: string) => counts.get(id)?.byDate.get(date) ?? 0;
  const bump = (id: string, date: string) => {
    const r = counts.get(id) ?? { chief: 0, assistant: 0, total: 0, byDate: new Map<string, number>() };
    r.assistant++;
    r.total++;
    r.byDate.set(date, (r.byDate.get(date) ?? 0) + 1);
    counts.set(id, r);
  };
  const order = [...pool].sort((a, b) => ctx.name(a).localeCompare(ctx.name(b)));
  const changed = new Map<string, string[]>();
  const targets = work
    .filter((p) => p.kind === "paper" && (!onlyPaperIds || onlyPaperIds.has(p.id)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.session - b.session || a.label.localeCompare(b.label));

  targets.forEach((p, k) => {
    const need = needed(p, ctx.settings) - new Set(p.invigilatorIds.filter((x) => x !== p.chiefId)).size;
    if (need <= 0) return;
    const ok = (id: string) => {
      if (id === p.chiefId || p.invigilatorIds.includes(id)) return false;
      if (unavailableFor(id, p.date, p.session, ctx.unavailable)) return false;
      if (work.some((q) => q.id !== p.id && q.date === p.date && q.session === p.session && peopleOn(q).includes(id))) return false;
      return onDay(id, p.date) < ctx.settings.maxPerDay;
    };
    const picks: string[] = [];
    if (ctx.settings.courseLecturersAssist) for (const id of courseLecturers(p, ctx)) if (need > picks.length && ok(id)) picks.push(id);
    // Rotate the alphabetical order per paper so ties don't always go to the same people.
    const rotated = order.map((_, i) => order[(i + k) % order.length]);
    // Undergraduate / part-time: a paper's own lecturers are only suggested if nobody else is free.
    const own = ctx.settings.courseLecturersAssist ? new Set<string>() : courseLecturers(p, ctx);
    const ranked = rotated
      .filter((id) => !picks.includes(id) && ok(id))
      .sort((a, b) => Number(own.has(a)) - Number(own.has(b)) || total(a) - total(b) || onDay(a, p.date) - onDay(b, p.date));
    for (const id of ranked) {
      if (picks.length >= need) break;
      picks.push(id);
    }
    if (!picks.length) return;
    for (const id of picks) bump(id, p.date);
    p.invigilatorIds.push(...picks);
    changed.set(p.id, p.invigilatorIds);
  });
  return changed;
}

/** The people who may be suggested as assistants: the saved list, or the department's staff (everyone for undergraduate). */
export function resolvePool(t: { invigilatorPool: string[] | null; dept: string | null }, all: readonly { id: string; dept: string | null }[]) {
  if (t.invigilatorPool) {
    const ids = new Set(all.map((l) => l.id));
    return t.invigilatorPool.filter((id) => ids.has(id));
  }
  return all.filter((l) => !t.dept || l.dept === t.dept).map((l) => l.id);
}
