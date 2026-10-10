/**
 * Part-time and postgraduate lecture timetables (one per department and programme) — pure rules, tested in programme.test.ts.
 * Rows are day × group (e.g. Friday · YEAR 1); columns are the timetable's own periods, which may include a break.
 */
import { codesOf } from "./timetable";
import type { Programme } from "./programmes";

export interface Period {
  label: string;
  isBreak?: boolean;
}
export interface VenueKeyItem {
  code: string;
  name: string;
}
export interface CalendarRow {
  weeks: string;
  dates: string;
  activity: string;
}
export type SlotKind = "course" | "activity";
export interface PSlot {
  id: string;
  day: number; // 0 = Sunday … 6 = Saturday
  group: number; // index into groups
  start: number; // index into periods
  span: number;
  label: string;
  kind: SlotKind;
  venue: string;
  note: string;
}
export type CourseCategory = "core" | "mandatory" | "elective" | "";
export interface PCourse {
  id: string;
  code: string;
  title: string;
  category: CourseCategory;
  semester: number; // 1 or 2
  lecturerIds: string[];
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const CATEGORY_MARK: Record<CourseCategory, string> = { core: "*", mandatory: "+", elective: "E", "": "" };
export const CATEGORY_LABEL: Record<CourseCategory, string> = { core: "Core", mandatory: "Mandatory", elective: "Elective", "": "—" };

export interface Template {
  days: number[];
  groups: string[];
  periods: Period[];
  venueKey: VenueKeyItem[];
  notes: string[];
  calendar: CalendarRow[];
}

/** How a new timetable starts (everything can be changed under Set-up). Based on the Faculty's current timetables. */
export function defaultTemplate(p: Programme): Template {
  if (p === "pt")
    return {
      days: [5, 6],
      groups: ["YEAR 1", "YEAR 2", "YEAR 3", "YEAR 4", "YEAR 5", "YEAR 6"],
      periods: [
        { label: "8:00A.M. – 9:00A.M." },
        { label: "9:00A.M. – 10:00A.M." },
        { label: "10:00A.M. – 11:00A.M." },
        { label: "11:00A.M. – 12:00P.M." },
        { label: "12:00P.M. – 1:00P.M." },
        { label: "1:00P.M. – 1:30P.M.", isBreak: true },
        { label: "1:30P.M. – 2:30P.M." },
        { label: "2:30P.M. – 3:30P.M." },
        { label: "3:30P.M. – 4:30P.M." },
        { label: "4:30P.M. – 5:30P.M." },
      ],
      venueKey: [
        { code: "A", name: "1000 LT" },
        { code: "B", name: "500 LT" },
        { code: "C", name: "Statistics LT" },
        { code: "D", name: "300L CSC Class Room" },
        { code: "E", name: "400L CSC Class Room" },
        { code: "F", name: "M.Sc. Class Room" },
      ],
      notes: ["Students writing GST examinations should endeavour to follow the University Time-Table."],
      calendar: [
        { weeks: "1 – 11", dates: "", activity: "FIRST SEMESTER LECTURES IN PROGRESS" },
        { weeks: "12", dates: "", activity: "REVISION / END OF FIRST SEMESTER LECTURES" },
        { weeks: "13 – 15", dates: "", activity: "FIRST SEMESTER EXAMINATIONS" },
      ],
    };
  return {
    days: [1, 2, 3, 4, 5],
    groups: [""],
    periods: [{ label: "9am – 12pm" }, { label: "1:00pm – 4:00pm" }],
    venueKey: [{ code: "MSC", name: "M.Sc. Lecture Classroom" }],
    notes: ["Lectures begin on ____ and end on ____ for the semester.", "Students should register at least 3 credits of elective courses from either the first or second semester."],
    calendar: [],
  };
}

/** Does a block starting at `start` and lasting `span` periods stay inside the day and clear of breaks? */
export function fits(periods: readonly Period[], start: number, span: number): boolean {
  if (!Number.isInteger(start) || !Number.isInteger(span) || span < 1 || start < 0 || start + span > periods.length) return false;
  for (let i = start; i < start + span; i++) if (periods[i].isBreak) return false;
  return true;
}

/** "8:00A.M. – 9:00A.M." + "9:00A.M. – 10:00A.M." → "8:00A.M. – 10:00A.M." */
export function timeRange(periods: readonly Period[], start: number, span: number): string {
  const first = periods[start]?.label ?? "";
  const last = periods[start + span - 1]?.label ?? first;
  const from = first.split(/\s*[–-]\s*/)[0];
  const parts = last.split(/\s*[–-]\s*/);
  const to = parts.length > 1 ? parts[parts.length - 1] : "";
  return to ? `${from} – ${to}` : first;
}

/** "CSC111(B)" — how a block prints in the grid. */
export const slotText = (s: Pick<PSlot, "label" | "venue">) => (s.venue ? `${s.label}(${s.venue})` : s.label);

export interface PIssue {
  type: "group" | "venue" | "lecturer" | "break" | "venueKey";
  severity: "error" | "warning";
  slotIds: string[];
  message: string;
}

const overlap = (a: PSlot, b: PSlot) => a.day === b.day && a.start < b.start + b.span && b.start < a.start + a.span;

/**
 * Problems in a part-time / postgraduate timetable.
 * - group:    one group (e.g. YEAR 2) has two things at once.
 * - venue:    one venue holds two classes at once.
 * - lecturer: one lecturer teaches two classes at once.
 * - break:    a class runs into a break or past the last period.
 * - venueKey: a class uses a venue that isn't in the key (warning).
 */
export function programmeIssues(
  slots: readonly PSlot[],
  ctx: { periods: readonly Period[]; groups: readonly string[]; venueKey: readonly VenueKeyItem[]; lecturersOf: (code: string) => readonly string[]; name: (id: string) => string },
): PIssue[] {
  const out: PIssue[] = [];
  const at = (s: PSlot) => `${WEEKDAYS[s.day]} ${timeRange(ctx.periods, s.start, s.span)}`;
  const groupName = (g: number) => ctx.groups[g] || "the class";
  const keys = new Set(ctx.venueKey.map((v) => v.code));
  for (const s of slots) {
    if (!fits(ctx.periods, s.start, s.span)) out.push({ type: "break", severity: "error", slotIds: [s.id], message: `${s.label} (${WEEKDAYS[s.day]}) runs into a break or past the last period.` });
    if (s.venue && !keys.has(s.venue)) out.push({ type: "venueKey", severity: "warning", slotIds: [s.id], message: `${s.label} uses venue ${s.venue}, which isn't in the venue key.` });
  }
  for (let i = 0; i < slots.length; i++)
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      if (!overlap(a, b)) continue;
      if (a.group === b.group && ctx.groups.length > 0)
        out.push({ type: "group", severity: "error", slotIds: [a.id, b.id], message: `${groupName(a.group)} has ${a.label} and ${b.label} at the same time (${at(a)}).` });
      if (a.venue && a.venue === b.venue && a.kind === "course" && b.kind === "course")
        out.push({ type: "venue", severity: "error", slotIds: [a.id, b.id], message: `Venue ${a.venue} has ${a.label} and ${b.label} at the same time (${at(a)}).` });
      if (a.kind === "course" && b.kind === "course") {
        const la = new Set(codesOf(a.label).flatMap(ctx.lecturersOf));
        for (const id of new Set(codesOf(b.label).flatMap(ctx.lecturersOf)))
          if (la.has(id)) out.push({ type: "lecturer", severity: "error", slotIds: [a.id, b.id], message: `${ctx.name(id)} teaches ${a.label} and ${b.label} at the same time (${at(a)}).` });
      }
    }
  return out;
}

/** Courses on the allocation list for this semester that aren't on the timetable yet. */
export function unscheduledCourses(courses: readonly PCourse[], slots: readonly PSlot[], semester: number): string[] {
  const on = new Set(slots.filter((s) => s.kind === "course").flatMap((s) => codesOf(s.label)));
  return courses.filter((c) => c.semester === semester && !on.has(c.code)).map((c) => c.code);
}

/** The groups shown for a timetable: at least one row per day, even when the timetable has a single unnamed group. */
export const groupRows = (groups: readonly string[]) => (groups.length ? groups : [""]);

/** Which semester (1 or 2) a semester name refers to. */
export const semesterNumber = (name: string) => (/second|2nd/i.test(name) ? 2 : 1);

/** Lecturers of a course on this timetable: the allocation list first, then the main course list. */
export function lecturersLookup(courses: readonly PCourse[], fromCourseList: Record<string, string[]>) {
  const alloc = new Map(courses.filter((c) => c.lecturerIds.length).map((c) => [c.code, c.lecturerIds]));
  return (code: string): readonly string[] => alloc.get(code) ?? fromCourseList[code] ?? [];
}
