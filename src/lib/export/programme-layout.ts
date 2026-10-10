/** A part-time / postgraduate lecture timetable as a printable document — shared by the print page and Word. Pure. */
import { DEPARTMENTS } from "../timetable";
import { CATEGORY_MARK, WEEKDAYS, groupRows, slotText, type PCourse, type PSlot } from "../programme";
import type { LecturerDTO, ProgrammeTimetableDTO } from "../types";
import { DOCUMENT_TEXT } from "./document-text";

export type ProgCell = { type: "empty"; start: number } | { type: "slot"; start: number; span: number; text: string; activity: boolean } | { type: "break"; start: number };
export interface ProgRow {
  day: string;
  /** First row of its day (prints the day name and the break cells, which span the day's rows). */
  firstOfDay: boolean;
  rowsInDay: number;
  group: string;
  cells: ProgCell[];
}
export interface ProgDoc {
  heading: string[];
  title: string;
  periods: { label: string; isBreak?: boolean }[];
  showGroups: boolean;
  rows: ProgRow[];
  venueKey: { code: string; name: string }[];
  calendar: { weeks: string; dates: string; activity: string }[];
  notes: string[];
  allocation: { semester: string; lines: string[] }[];
  hasCategories: boolean;
  signatory: { name: string; role: string };
  landscape: boolean;
}

export function buildProgrammeDoc(t: ProgrammeTimetableDTO, slots: readonly PSlot[], courses: readonly PCourse[], staff: readonly LecturerDTO[]): ProgDoc {
  const groups = groupRows(t.groups);
  const rows: ProgRow[] = [];
  for (const day of t.days)
    groups.forEach((g, gi) => {
      const mine = slots.filter((s) => s.day === day && s.group === gi).sort((a, b) => a.start - b.start || b.span - a.span);
      const cells: ProgCell[] = [];
      let p = 0;
      let i = 0;
      while (p < t.periods.length) {
        if (t.periods[p].isBreak) {
          cells.push({ type: "break", start: p });
          p++;
          continue;
        }
        const s = mine[i];
        if (s && s.start === p) {
          // Anything else starting inside this block is a clash; print it alongside rather than lose it.
          const extra: string[] = [];
          let j = i + 1;
          while (j < mine.length && mine[j].start < s.start + s.span) extra.push(slotText(mine[j++]));
          cells.push({ type: "slot", start: p, span: s.span, text: [slotText(s), ...extra].join(" · "), activity: s.kind === "activity" });
          p += s.span;
          i = j;
          continue;
        }
        while (mine[i] && mine[i].start < p) i++; // ignore leftovers that overlapped an earlier block
        cells.push({ type: "empty", start: p });
        p++;
      }
      rows.push({ day: WEEKDAYS[day].toUpperCase(), firstOfDay: gi === 0, rowsInDay: groups.length, group: g, cells });
    });

  const name = new Map(staff.map((l) => [l.id, l.name]));
  const allocation = [1, 2]
    .map((sem) => ({
      semester: sem === 1 ? "First Semester" : "Second Semester",
      lines: courses
        .filter((c) => c.semester === sem)
        .map((c) => {
          const lec = c.lecturerIds.map((id) => name.get(id)).filter(Boolean);
          return `${CATEGORY_MARK[c.category]}${c.code}${c.title ? `: ${c.title}` : ""}${lec.length ? ` [${lec.join("; ")}]` : ""}`;
        }),
    }))
    .filter((a) => a.lines.length);

  return {
    heading: [`DEPARTMENT OF ${(DEPARTMENTS[t.dept] ?? t.dept).toUpperCase()}`, `${DOCUMENT_TEXT.faculty}, UNIVERSITY OF BENIN`, "BENIN CITY, NIGERIA."],
    title: t.title,
    periods: t.periods,
    showGroups: groups.some(Boolean),
    rows,
    venueKey: t.venueKey,
    calendar: t.calendar,
    notes: t.notes,
    allocation,
    hasCategories: courses.some((c) => c.category),
    signatory: { name: t.signatoryName, role: t.signatoryRole },
    landscape: t.periods.length > 4,
  };
}
