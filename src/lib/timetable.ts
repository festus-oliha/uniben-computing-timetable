/** Shared timetable vocabulary — safe to import from both server and browser code. */

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI"] as const;

/** One-hour teaching slots. Index 0–5 is the morning block, 6–9 the afternoon block. */
export const SLOTS = [
  "8–9",
  "9–10",
  "10–11",
  "11–12",
  "12–1",
  "1–2",
  "2:30–3:30",
  "3:30–4:30",
  "4:30–5:30",
  "5:30–6:30",
] as const;

export const BREAK_LABEL = "2:00–2:30";
/** Friday 1–2 p.m. is reserved for Jumat prayers. */
export const JUMAT = { day: 4, slot: 5 } as const;

export const DEPARTMENTS: Record<string, string> = {
  COS: "Common (COS)",
  CSC: "Computer Science",
  CYB: "Cyber Security",
  DTS: "Data Science",
  ICT: "Information & Communication Technology",
  IFT: "Information Technology",
  INS: "Information Systems",
  SEN: "Software Engineering",
  GST: "General Studies",
  ENT: "Entrepreneurship",
  CED: "Centre for Entrepreneurship Development",
  MTH: "Mathematics",
  UMTH: "Mathematics",
  STA: "Statistics",
  PHY: "Physics",
  CHM: "Chemistry",
  GLY: "Geology",
};

/** The faculty's own teaching departments (used for lecturers and filters). */
export const FACULTY_DEPTS = ["CSC", "CYB", "DTS", "ICT", "IFT", "INS", "SEN"] as const;

const COMPUTING = new Set(["COS", "CSC", "CYB", "DTS", "ICT", "IFT", "INS", "SEN"]);
const SCIENCE = new Set(["MTH", "UMTH", "PHY", "CHM", "STA", "GLY"]);
const GENERAL = new Set(["GST", "ENT", "CED"]);

export type Kind = "course" | "activity" | "pt" | "shared";
export type Category = "comp" | "sci" | "gen" | "act" | "pt" | "shared";

export const KIND_LABELS: Record<Kind, string> = {
  course: "Course lecture",
  activity: "Tutorial / practical",
  pt: "Part-time (PT)",
  shared: "Other faculty booking",
};

const CODE_RE = /^[A-Z]{2,5}\d{3}$/;

/** "CSC308 / csc411" → ["CSC308", "CSC411"]. Anything that isn't a course code is ignored. */
export function codesOf(label: string): string[] {
  return String(label || "")
    .split("/")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => CODE_RE.test(s));
}

export const isCourseCode = (s: string) => CODE_RE.test(s.trim().toUpperCase());
export const prefixOf = (code: string) => (code.match(/^[A-Z]+/) ?? [""])[0];

/** CSC308 → 3, UMTH251 → 2. */
export function levelOf(code: string): number | null {
  const m = code.match(/(\d)\d\d$/);
  return m ? Number(m[1]) : null;
}

/** The colour family a booking is drawn in. */
export function categoryOf(b: { kind: Kind; label: string }): Category {
  if (b.kind === "shared") return "shared";
  if (b.kind === "pt") return "pt";
  if (b.kind === "activity") return "act";
  const p = prefixOf(codesOf(b.label)[0] ?? b.label.toUpperCase());
  if (COMPUTING.has(p)) return "comp";
  if (SCIENCE.has(p)) return "sci";
  if (GENERAL.has(p)) return "gen";
  return "act";
}

/** The morning or afternoon block a slot sits in, as [first, last] slot index. */
export const blockOf = (slot: number): [number, number] => (slot < 6 ? [0, 5] : [6, 9]);

/** True when a booking of `span` hours starting at `start` stays inside one block (doesn't cross the break). */
export function fitsInBlock(start: number, span: number): boolean {
  if (start < 0 || start > 9 || span < 1) return false;
  const [, last] = blockOf(start);
  return start + span - 1 <= last;
}

export const levelName = (level: number | null | undefined) => (level ? `${level}00 Level` : "Unknown level");
