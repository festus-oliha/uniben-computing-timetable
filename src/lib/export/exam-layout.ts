/** The examination timetable as a printable document — shared by the print page and the Word export. Pure. */
import { DEPARTMENTS } from "../timetable";
import { dateLabel, paperText, sessionNumber, weekOf } from "../exam";
import type { ExamPaperDTO, ExamSessionDTO, ExamTimetableDTO } from "../types";
import { DOCUMENT_TEXT, EXAM_TEXT } from "./document-text";

export interface ExamDocLine {
  text: string;
  block: boolean;
}
export type ExamDocRow =
  | { type: "week"; label: string }
  | { type: "date"; day: string; date: string; cells: { number: number; lines: ExamDocLine[] }[] };

export interface ExamDoc {
  university: string;
  faculty: string;
  department: string | null;
  title: string;
  sessions: ExamSessionDTO[];
  rows: ExamDocRow[];
  notes: string[];
  closing: string | null;
  venues: { code: string; name: string }[];
  cc: string[];
  signatory: { name: string; role: string; forWhom: string | null };
}

export function buildExamDoc(t: ExamTimetableDTO, papers: readonly ExamPaperDTO[], venues: readonly { code: string; name: string }[]): ExamDoc {
  const rows: ExamDocRow[] = [];
  const weekly = t.programme === "pt";
  let lastWeek = 0;
  t.dates.forEach((date, di) => {
    const wk = weekOf(t.dates, date);
    if (weekly && wk !== lastWeek) rows.push({ type: "week", label: `WEEK ${wk}` });
    lastWeek = wk;
    const dl = dateLabel(date);
    rows.push({
      type: "date",
      day: dl.day,
      date: dl.date,
      cells: t.sessions.map((_, si) => ({
        number: sessionNumber(di, si, t.sessions.length),
        lines: papers
          .filter((p) => p.date === date && p.session === si)
          .sort((a, b) => Number(b.kind === "block") - Number(a.kind === "block") || a.label.localeCompare(b.label))
          .map((p) => ({ text: paperText(p) + (p.note ? ` – ${p.note}` : ""), block: p.kind === "block" })),
      })),
    });
  });

  const used = new Set(papers.flatMap((p) => p.venues));
  const ug = t.dept === null;
  return {
    university: DOCUMENT_TEXT.university,
    faculty: DOCUMENT_TEXT.faculty,
    department: t.dept ? `DEPARTMENT OF ${(DEPARTMENTS[t.dept] ?? t.dept).toUpperCase()}` : null,
    title: t.title,
    sessions: t.sessions,
    rows,
    notes: t.notes,
    closing: t.programme === "ug" || t.programme === "pt" ? EXAM_TEXT.closing : null,
    venues: venues.filter((v) => used.has(v.code)).map((v) => ({ code: v.code, name: v.name })),
    cc: [...(ug ? EXAM_TEXT.cc : EXAM_TEXT.deptCc)],
    signatory: { name: t.signatoryName, role: t.signatoryRole, forWhom: ug ? DOCUMENT_TEXT.signatory.forWhom : null },
  };
}
