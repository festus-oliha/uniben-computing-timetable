import { codesOf, prefixOf, type Kind } from "./timetable";

/**
 * Who may change what. Pure functions — used by the server actions (which enforce them)
 * and by the screens (which hide or disable controls). Keep both in step by only using these.
 */

export type Role = "admin" | "dept_officer" | "viewer";

export interface Actor {
  role: Role;
  /** Department code for a dept_officer (CSC, CYB, …). */
  dept: string | null;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Faculty Time-Table Officer",
  dept_officer: "Department Officer",
  viewer: "Viewer",
};

/** Looks up a course's department; falls back to the code prefix (CSC308 → CSC). */
export type DeptOf = (code: string) => string;
export const deptFromCode: DeptOf = (code) => prefixOf(code);

export const isAdmin = (a: Actor | null) => a?.role === "admin";
export const canManageUsers = isAdmin;
export const canSignOff = isAdmin;

/** Can this person add or edit anything on the timetable at all? (Shows the "add" affordances.) */
export const canEditTimetable = (a: Actor | null) => a?.role === "admin" || (a?.role === "dept_officer" && !!a.dept);

/**
 * A department officer may edit a booking only when it is a course lecture and every course in it
 * belongs to their department. Tutorials, part-time periods, other faculties' bookings and common
 * courses (COS, GST, …) stay with the Faculty Officer.
 */
export function canEditBooking(a: Actor | null, b: { kind: Kind; label: string }, deptOf: DeptOf = deptFromCode): boolean {
  if (!a) return false;
  if (a.role === "admin") return true;
  if (a.role !== "dept_officer" || !a.dept) return false;
  if (b.kind !== "course") return false;
  const codes = codesOf(b.label);
  return codes.length > 0 && codes.every((c) => deptOf(c) === a.dept);
}

export function canEditCourse(a: Actor | null, course: { code: string; dept: string }): boolean {
  if (!a) return false;
  if (a.role === "admin") return true;
  return a.role === "dept_officer" && !!a.dept && course.dept === a.dept;
}

/** Only the Faculty Officer decides which courses are common to all departments, or moves a course between departments. */
export const canChangeCourseScope = isAdmin;

export function canManageLecturer(a: Actor | null, lecturer: { dept: string | null }): boolean {
  if (!a) return false;
  if (a.role === "admin") return true;
  return a.role === "dept_officer" && !!a.dept && lecturer.dept === a.dept;
}

/** The message shown when a department officer tries something outside their department. */
export function outsideDeptMessage(a: Actor | null): string {
  if (!a || a.role === "viewer") return "You have view-only access. Ask the Faculty Time-Table Officer to make this change.";
  return `You can only change ${a.dept ?? "your department's"} course lectures. Ask the Faculty Time-Table Officer for anything else.`;
}
