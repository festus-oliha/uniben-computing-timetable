/** Examination timetable rules — pure functions, tested in exam.test.ts. */
import { codesOf, levelName, levelOf, prefixOf } from "./timetable";

export interface PaperLike {
  id: string;
  date: string; // YYYY-MM-DD
  session: number; // 0-based column
  label: string;
  kind: "paper" | "block";
  venues: string[];
  year: string | null;
  chiefId: string | null;
  invigilatorIds: string[];
}

export interface ExamCourseInfo {
  level: number | null;
  dept: string;
  isCommon: boolean;
}

export interface ExamIssue {
  type: "students" | "duplicate" | "invigilator" | "sameDay";
  severity: "error" | "warning";
  paperIds: string[];
  message: string;
}

const DAY_SHORT = ["Sun.", "Mon.", "Tue.", "Wed.", "Thur.", "Fri.", "Sat."];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(parse(s)) === s;

/** "2026-03-16" → { day: "Mon.", long: "Monday", date: "16/03/26", full: "16/03/2026" } */
export function dateLabel(isoDate: string) {
  const d = parse(isoDate);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return { day: DAY_SHORT[d.getUTCDay()], long: DAY_LONG[d.getUTCDay()], date: `${dd}/${mm}/${String(yyyy).slice(2)}`, full: `${dd}/${mm}/${yyyy}`, weekday: d.getUTCDay() };
}

/** Every date from start to end (inclusive) that falls on one of the weekdays (0 = Sunday … 6 = Saturday). */
export function datesBetween(start: string, end: string, weekdays: number[]): string[] {
  if (!isIsoDate(start) || !isIsoDate(end)) return [];
  const out: string[] = [];
  for (let d = parse(start); d <= parse(end) && out.length < 200; d = new Date(d.getTime() + 86_400_000)) {
    if (weekdays.includes(d.getUTCDay())) out.push(iso(d));
  }
  return out;
}

/** Sessions are numbered across the whole timetable: date 1 → 1, 2, 3; date 2 → 4, 5, 6 … */
export const sessionNumber = (dateIndex: number, session: number, sessionsPerDay: number) => dateIndex * sessionsPerDay + session + 1;

/** "W, T,p1 ; P2" → ["W", "T", "P1", "P2"] (no duplicates, order kept). */
export function parseVenues(s: string): string[] {
  return [...new Set(s.split(/[,;\s]+/).map((v) => v.trim().toUpperCase()).filter(Boolean))];
}

/** How a paper prints in a session cell: "CSC313/CSC301 (T, P1)", or "GST" for a block. */
export function paperText(p: Pick<PaperLike, "label" | "kind" | "venues" | "year">) {
  if (p.kind === "block") return p.label;
  const inside = [p.year, ...p.venues].filter(Boolean).join(", ");
  return inside ? `${p.label} (${inside})` : p.label;
}

/** Week number (1-based) of a date within the exam period, counting Monday-started weeks from the first date. */
export function weekOf(dates: string[], date: string): number {
  if (!dates.length) return 1;
  const first = parse(dates[0]);
  const monday = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * 86_400_000);
  return Math.floor((parse(date).getTime() - monday.getTime()) / (7 * 86_400_000)) + 1;
}

type Ctx = { course: (code: string) => ExamCourseInfo | undefined; lecturerName?: (id: string) => string | undefined };

function info(code: string, ctx: Ctx): ExamCourseInfo {
  return ctx.course(code) ?? { level: levelOf(code), dept: prefixOf(code), isCommon: false };
}

/** Who sits the paper, for clash checks: part-time papers by year group; others by level + department. */
function groups(p: PaperLike, ctx: Ctx) {
  return codesOf(p.label).map((c) => ({ code: c, ...info(c, ctx) }));
}

function sameStudents(a: PaperLike, b: PaperLike, ctx: Ctx): string | null {
  if (a.year && b.year) return a.year === b.year ? `both are ${a.year} papers` : null;
  for (const x of groups(a, ctx))
    for (const y of groups(b, ctx)) {
      if (x.code === y.code) continue;
      if (x.level != null && x.level === y.level && (x.dept === y.dept || x.isCommon || y.isCommon)) {
        return x.isCommon || y.isCommon
          ? `${(x.isCommon ? x : y).code} is common to all ${levelName(x.level)} students`
          : `both are ${x.dept} ${levelName(x.level)} papers`;
      }
    }
  return null;
}

/**
 * Problems in an examination timetable.
 * - students (error):    the same students have two papers in one session.
 * - duplicate (error):   a course is examined more than once.
 * - invigilator (error): one person invigilates two different papers in the same session.
 * - sameDay (warning):   the same students have two papers on the same day.
 * Venues are not checked: large halls are shared by several papers in one session by design.
 */
export function examIssues(papers: readonly PaperLike[], ctx: Ctx): ExamIssue[] {
  const out: ExamIssue[] = [];
  const list = papers.filter((p) => p.kind === "paper");
  const when = (p: PaperLike, sessionName?: string) => `${dateLabel(p.date).day} ${dateLabel(p.date).date}${sessionName ? `, ${sessionName}` : ""}`;

  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.date !== b.date) continue;
      const why = sameStudents(a, b, ctx);
      if (!why) continue;
      if (a.session === b.session)
        out.push({ type: "students", severity: "error", paperIds: [a.id, b.id], message: `${a.label} and ${b.label} are in the same session (${when(a)}): ${why}.` });
      else out.push({ type: "sameDay", severity: "warning", paperIds: [a.id, b.id], message: `${a.label} and ${b.label} are on the same day (${when(a)}): ${why}.` });
    }

  const seen = new Map<string, PaperLike>();
  for (const p of list)
    for (const c of codesOf(p.label)) {
      const prev = seen.get(c);
      if (prev && prev.id !== p.id) out.push({ type: "duplicate", severity: "error", paperIds: [prev.id, p.id], message: `${c} is scheduled twice (${when(prev)} and ${when(p)}).` });
      else seen.set(c, p);
    }

  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.date !== b.date || a.session !== b.session) continue;
      const pa = new Set([a.chiefId, ...a.invigilatorIds].filter(Boolean) as string[]);
      const both = [b.chiefId, ...b.invigilatorIds].filter((x): x is string => !!x && pa.has(x));
      for (const id of new Set(both))
        out.push({ type: "invigilator", severity: "error", paperIds: [a.id, b.id], message: `${ctx.lecturerName?.(id) ?? "An invigilator"} is assigned to both ${a.label} and ${b.label} (${when(a)}).` });
    }
  return out;
}

/** Course codes that are taught (on the lecture timetable) but have no examination yet. */
export function unscheduled(taughtCodes: Iterable<string>, papers: readonly PaperLike[]): string[] {
  const examined = new Set(papers.filter((p) => p.kind === "paper").flatMap((p) => codesOf(p.label)));
  return [...new Set(taughtCodes)].filter((c) => !examined.has(c)).sort();
}

/** What a visitor asked to see on the public examination page. */
export type ExamFilter = { kind: "all" } | { kind: "class"; level: number; dept: string } | { kind: "year"; year: string };

/**
 * The papers a visitor should see, in date and session order.
 * - class: papers with a course at that level in that department, plus that level's common courses.
 * - year:  part-time papers for that year group.
 * - all:   every paper and block.
 */
export function examEntries<P extends PaperLike>(filter: ExamFilter, papers: readonly P[], course: (code: string) => ExamCourseInfo | undefined): P[] {
  const keep = (p: P) => {
    if (filter.kind === "all") return true;
    if (p.kind !== "paper") return false;
    if (filter.kind === "year") return p.year === filter.year;
    return codesOf(p.label).some((c) => {
      const i = course(c) ?? { level: levelOf(c), dept: prefixOf(c), isCommon: false };
      return i.level === filter.level && (i.dept === filter.dept || i.isCommon);
    });
  };
  return papers.filter(keep).sort((a, b) => a.date.localeCompare(b.date) || a.session - b.session || a.label.localeCompare(b.label));
}
