/** Staff Members — pure rules shared by the screens, the server actions and the import (tested in staff.test.ts). */
import { FACULTY_DEPARTMENTS } from "./site-content";

export type StaffCategory = "academic" | "technical" | "administrative";

export const CATEGORIES: Record<StaffCategory, { label: string; plural: string }> = {
  academic: { label: "Academic", plural: "Academic staff" },
  technical: { label: "Technical", plural: "Technical staff" },
  administrative: { label: "Administrative", plural: "Administrative staff" },
};

/** Usual ranks, most senior first (anything else typed is kept as written and sorted after these). */
export const RANKS: Record<StaffCategory, string[]> = {
  academic: ["Professor", "Reader", "Senior Lecturer", "Lecturer I", "Lecturer II", "Assistant Lecturer", "Graduate Assistant"],
  technical: ["Chief Technologist", "Principal Technologist", "Senior Technologist", "Technologist I", "Technologist II", "Assistant Technologist", "Laboratory Assistant"],
  administrative: ["Faculty Officer", "Principal Executive Officer", "Senior Executive Officer", "Executive Officer", "Senior Confidential Secretary", "Confidential Secretary", "Clerical Officer"],
};

const ALIASES: Record<string, string> = {
  prof: "Professor",
  "assoc. prof": "Reader",
  "associate professor": "Reader",
  sl: "Senior Lecturer",
  "lecturer 1": "Lecturer I",
  "lecturer one": "Lecturer I",
  "lecturer i": "Lecturer I",
  li: "Lecturer I",
  "lecturer 2": "Lecturer II",
  "lecturer two": "Lecturer II",
  "lecturer ii": "Lecturer II",
  lii: "Lecturer II",
  al: "Assistant Lecturer",
  ga: "Graduate Assistant",
};

/** "lecturer 1" → "Lecturer I", "SL" → "Senior Lecturer"; unknown ranks are kept (tidied). */
export function normaliseRank(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return "";
  const key = s.toLowerCase().replace(/\.$/, "");
  if (ALIASES[key]) return ALIASES[key];
  for (const list of Object.values(RANKS)) {
    const hit = list.find((r) => r.toLowerCase() === key);
    if (hit) return hit;
  }
  return s;
}

/** Sort key: known ranks by seniority, then anything else. */
export function rankOrder(rank: string): number {
  for (const list of Object.values(RANKS)) {
    const i = list.indexOf(rank);
    if (i >= 0) return i;
  }
  return 50;
}

/** Guess the category from a rank or a typed category word. */
export function categoryOf(rank: string, typed = ""): StaffCategory {
  const t = typed.trim().toLowerCase();
  if (/^tech|lab/.test(t)) return "technical";
  if (/^admin|non.?teach|senior staff|junior staff/.test(t)) return "administrative";
  if (/^acad|teach/.test(t)) return "academic";
  if (RANKS.technical.includes(rank) || /technolog|laborator/i.test(rank)) return "technical";
  if (RANKS.administrative.includes(rank) || /officer|secretar|clerk|typist|driver|messenger|registr/i.test(rank)) return "administrative";
  return "academic";
}

/** "CSC", "Computer Science", "Dept. of Computer Science" → "CSC"; null when it isn't one of the Faculty's departments. */
export function deptCode(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/^(the\s+)?(dept\.?|department)\s+(of\s+)?/, "").replace(/&/g, "and");
  if (!s) return null;
  for (const d of FACULTY_DEPARTMENTS) {
    if (d.code.toLowerCase() === s) return d.code;
    if (d.name.toLowerCase().replace(/&/g, "and") === s) return d.code;
  }
  for (const d of FACULTY_DEPARTMENTS) if (s.includes(d.name.toLowerCase().replace(/&/g, "and"))) return d.code;
  return null;
}

/* ---------- import ---------- */

export type StaffField = "name" | "rank" | "dept" | "category" | "position" | "staffNo" | "email" | "phone" | "office" | "qualifications" | "interests";

export const FIELD_LABELS: Record<StaffField, string> = {
  name: "Name",
  rank: "Rank / designation",
  dept: "Department",
  category: "Category (academic, technical …)",
  position: "Position (HOD, Sub-Dean …)",
  staffNo: "Staff number",
  email: "Email",
  phone: "Phone",
  office: "Office",
  qualifications: "Qualifications",
  interests: "Research interests / specialisation",
};

const HEADER_HINTS: [StaffField, RegExp][] = [
  ["staffNo", /staff\s*(no|num|id)|pf\s*no|file\s*no/i],
  ["email", /e-?mail/i],
  ["phone", /phone|gsm|mobile|tel/i],
  ["qualifications", /qualif|degree/i],
  ["interests", /interest|speciali|research|area/i],
  ["position", /position|role|appointment|office held/i],
  ["office", /office|room/i],
  ["category", /category|cadre|staff type|type of staff/i],
  ["dept", /dep(t|artment)|unit/i],
  ["rank", /rank|designation|grade|status|post/i],
  ["name", /name|staff$/i],
];

/** Which staff field each spreadsheet column most likely holds (null = ignore). */
export function detectColumns(headers: string[]): (StaffField | null)[] {
  const used = new Set<StaffField>();
  return headers.map((h) => {
    const hit = HEADER_HINTS.find(([f, re]) => !used.has(f) && re.test(h));
    if (!hit) return null;
    used.add(hit[0]);
    return hit[0];
  });
}

export interface StaffDraft {
  name: string;
  rank: string;
  dept: string | null;
  category: StaffCategory;
  position: string;
  staffNo: string;
  email: string;
  phone: string;
  office: string;
  qualifications: string;
  interests: string;
}

/** Turns spreadsheet rows into staff records, with a list of rows skipped and why. */
export function rowsToStaff(rows: string[][], columns: (StaffField | null)[]) {
  const staff: StaffDraft[] = [];
  const skipped: { row: number; reason: string }[] = [];
  rows.forEach((r, i) => {
    const get = (f: StaffField) => {
      const k = columns.indexOf(f);
      return k >= 0 ? String(r[k] ?? "").trim() : "";
    };
    const name = get("name").replace(/\s+/g, " ");
    if (!name || /^s\/?n$|^name$/i.test(name)) return skipped.push({ row: i + 1, reason: name ? "header row" : "no name" });
    if (/^\d+$/.test(name)) return skipped.push({ row: i + 1, reason: "name is a number" });
    const rank = normaliseRank(get("rank"));
    const deptText = get("dept");
    staff.push({
      name,
      rank,
      dept: deptCode(deptText),
      category: categoryOf(rank, get("category")),
      position: get("position"),
      staffNo: get("staffNo"),
      email: get("email").toLowerCase(),
      phone: get("phone"),
      office: get("office"),
      qualifications: get("qualifications"),
      interests: get("interests"),
    });
  });
  return { staff, skipped };
}

/** Splits pasted text (from Excel or a Word table) into rows of cells. */
export function parsePasted(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const sep = lines.some((l) => l.includes("\t")) ? "\t" : lines.every((l) => l.includes(",")) ? "," : "\t";
  return lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, "$1")));
}

/** Matching key for "is this person already on the list?" — staff number if both have one, else the name without titles. */
export function sameKey(name: string) {
  return name
    .toLowerCase()
    .replace(/\((mrs?|ms|miss)\.?\)/g, " ")
    .replace(/\b(prof|professor|dr|mr|mrs|ms|miss|engr|rev|arc|barr)\b\.?/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

/** Initials for a staff tile without a photo: "Prof. (Mrs.) S. Konyeha" → "SK". */
export function initials(name: string) {
  const words = name.replace(/\((.*?)\)/g, " ").split(/\s+/).filter((w) => w && !/^(prof|professor|dr|mr|mrs|ms|miss|engr|rev)\.?$/i.test(w));
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Checks a staff record before saving. Returns a message, or null when it's fine. */
export function staffProblem(s: { name: string; email: string; category: string; phone: string }): string | null {
  if (!s.name.trim()) return "Type the staff member's name.";
  if (s.name.length > 120) return "That name is too long.";
  if (!(s.category in CATEGORIES)) return "Choose academic, technical or administrative.";
  if (s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) return "That email address doesn't look right.";
  if (s.phone && !/^[+()\d\s-]{7,20}$/.test(s.phone)) return "Phone numbers can use digits, spaces, + and - only.";
  return null;
}
