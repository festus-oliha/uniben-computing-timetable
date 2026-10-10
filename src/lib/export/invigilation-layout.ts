/** The invigilation schedule as a printable document — shared by the print page and the Word export. Pure. */
import { DEPARTMENTS } from "../timetable";
import { dateLabel, paperText, sessionNumber, weekOf } from "../exam";
import { dutyCounts, printName } from "../invigilation";
import type { ExamPaperDTO, ExamSessionDTO, ExamTimetableDTO, LecturerDTO } from "../types";
import { DOCUMENT_TEXT } from "./document-text";

export interface InvDocLine {
  paper: string;
  chief: string;
  assistants: string;
  block: boolean;
}
export type InvDocRow =
  | { type: "week"; label: string }
  | { type: "date"; day: string; date: string; cells: { number: number; lines: InvDocLine[] }[] };

export interface InvDuty {
  id: string;
  short: string;
  name: string;
  chief: number;
  assistant: number;
  duties: string[];
}

export interface InvDoc {
  heading: string[];
  title: string;
  sessions: ExamSessionDTO[];
  rows: InvDocRow[];
  levels: string[];
  venues: { code: string; name: string }[];
  duties: InvDuty[];
  signatory: { name: string; role: string; forWhom: string | null };
}

/** "FIRST SEMESTER EXAMINATION TIMETABLE FOR …" → "FIRST SEMESTER EXAMINATION INVIGILATION SCHEDULE FOR …" */
export function invigilationTitle(examTitle: string) {
  const t = examTitle.replace(/EXAMINATION\s+TIME-?\s?TABLE/i, "EXAMINATION INVIGILATION SCHEDULE");
  return t === examTitle ? `${examTitle} — INVIGILATION SCHEDULE` : t;
}

const YEAR_NAMES = ["One", "Two", "Three", "Four", "Five", "Six", "Seven"];

export function buildInvigilationDoc(
  t: ExamTimetableDTO,
  papers: readonly ExamPaperDTO[],
  staff: readonly LecturerDTO[],
  venues: readonly { code: string; name: string }[],
): InvDoc {
  const person = new Map(staff.map((l) => [l.id, l]));
  const short = (id: string) => (person.has(id) ? printName(person.get(id)!) : "");
  const rows: InvDocRow[] = [];
  let lastWeek = 0;
  t.dates.forEach((date, di) => {
    const wk = weekOf(t.dates, date);
    if (t.programme === "pt" && wk !== lastWeek) rows.push({ type: "week", label: `WEEK ${wk}` });
    lastWeek = wk;
    const dl = dateLabel(date);
    rows.push({
      type: "date",
      day: dl.long,
      date: dl.date,
      cells: t.sessions.map((_, si) => ({
        number: sessionNumber(di, si, t.sessions.length),
        lines: papers
          .filter((p) => p.date === date && p.session === si)
          .sort((a, b) => Number(b.kind === "block") - Number(a.kind === "block") || a.label.localeCompare(b.label))
          .map((p) => ({
            paper: paperText(p),
            chief: p.chiefId ? short(p.chiefId) : "",
            assistants: p.invigilatorIds.filter((x) => x !== p.chiefId).map(short).filter(Boolean).join(", "),
            block: p.kind === "block",
          })),
      })),
    });
  });

  const real = papers.filter((p) => p.kind === "paper");
  const counts = dutyCounts(real);
  const ordered = [...real].sort((a, b) => a.date.localeCompare(b.date) || a.session - b.session);
  const duties: InvDuty[] = [...counts.keys()]
    .filter((id) => person.has(id))
    .map((id) => ({
      id,
      short: short(id),
      name: person.get(id)!.name,
      chief: counts.get(id)!.chief,
      assistant: counts.get(id)!.assistant,
      duties: ordered
        .filter((p) => p.chiefId === id || p.invigilatorIds.includes(id))
        .map((p) => `${dateLabel(p.date).day} ${dateLabel(p.date).date} ${t.sessions[p.session]?.name.replace(/\s*session$/i, "") ?? ""}: ${p.label}${p.chiefId === id ? " (chief)" : ""}`),
    }))
    .sort((a, b) => a.short.localeCompare(b.short));

  const usedVenues = new Set(real.flatMap((p) => p.venues));
  const years = [...new Set(real.map((p) => p.year).filter((y): y is string => !!y))].sort();
  const deptName = t.dept ? (DEPARTMENTS[t.dept] ?? t.dept).toUpperCase() : null;
  return {
    heading: [deptName ? `DEPARTMENT OF ${deptName}` : DOCUMENT_TEXT.faculty, deptName ? `${DOCUMENT_TEXT.faculty}, UNIVERSITY OF BENIN` : DOCUMENT_TEXT.university],
    title: invigilationTitle(t.title),
    sessions: t.sessions,
    rows,
    levels: years.map((y) => `${y} – Year ${YEAR_NAMES[Number(y.slice(1)) - 1] ?? y.slice(1)}`),
    venues: venues.filter((v) => usedVenues.has(v.code)).map((v) => ({ code: v.code, name: v.name })),
    duties,
    signatory: { name: t.signatoryName, role: t.signatoryRole, forWhom: t.dept ? null : DOCUMENT_TEXT.signatory.forWhom },
  };
}
