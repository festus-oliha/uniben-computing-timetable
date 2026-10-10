/** Rules for academic sessions and semesters (pure — tested in semester.test.ts). */

export const SEMESTER_NAMES = ["First Semester", "Second Semester"] as const;

export type CopyMode = "all" | "fixed" | "none";

export const COPY_MODES: Record<CopyMode, { label: string; hint: string }> = {
  all: { label: "Everything", hint: "All lectures, tutorials, part-time periods and other faculties' bookings — then adjust." },
  fixed: {
    label: "Fixed periods only",
    hint: "Other faculties' bookings, part-time periods, tutorials and practicals — no course lectures.",
  },
  none: { label: "Nothing (blank grid)", hint: "Start from an empty timetable." },
};

/** Which bookings to carry into a new semester. */
export function shouldCopy(mode: CopyMode, kind: "course" | "activity" | "pt" | "shared"): boolean {
  if (mode === "all") return true;
  if (mode === "fixed") return kind !== "course";
  return false;
}

/** "2026/2027" → null; anything else → a message. The second year must follow the first. */
export function sessionProblem(session: string): string | null {
  const m = session.trim().match(/^(\d{4})\/(\d{4})$/);
  if (!m) return "Write the session like 2026/2027.";
  if (Number(m[2]) !== Number(m[1]) + 1) return "The second year must follow the first, e.g. 2026/2027.";
  return null;
}

/** The session and semester that normally follow: First → Second (same session); Second → First of the next session. */
export function nextSemester(session: string, name: string): { session: string; name: string } {
  const m = session.match(/^(\d{4})\/(\d{4})$/);
  if (name === "First Semester") return { session, name: "Second Semester" };
  if (m) return { session: `${Number(m[1]) + 1}/${Number(m[2]) + 1}`, name: "First Semester" };
  return { session, name: "First Semester" };
}
