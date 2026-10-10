import { DAYS, JUMAT, SLOTS, codesOf, levelName, levelOf, prefixOf, type Kind } from "./timetable";

/** The minimum a booking needs for clash checking (matches the `bookings` table). */
export interface SlotLike {
  id: string;
  venueCode: string;
  day: number;
  start: number;
  span: number;
  label: string;
  kind: Kind;
}

export interface CourseInfo {
  code: string;
  level: number | null;
  dept: string;
  isCommon: boolean;
  lecturerIds: string[];
}

export type ClashType = "venue" | "students" | "lecturer" | "jumat";

export interface Clash {
  type: ClashType;
  severity: "error" | "warning";
  bookingIds: string[];
  message: string;
}

export interface ClashContext {
  courses: Map<string, CourseInfo>;
  lecturerName?: (id: string) => string | undefined;
}

/** Course details, falling back to what the code itself says (CSC308 → 300 Level, CSC dept). */
export function courseInfo(code: string, ctx: ClashContext): CourseInfo {
  return (
    ctx.courses.get(code) ?? {
      code,
      level: levelOf(code),
      dept: prefixOf(code),
      isCommon: false,
      lecturerIds: [],
    }
  );
}

export const overlaps = (a: SlotLike, b: SlotLike) =>
  a.day === b.day && a.start < b.start + b.span && b.start < a.start + a.span;

/**
 * Every clash on the timetable.
 *
 * - venue:    two bookings in the same venue at the same time (any kind, other faculties included).
 * - students: two course lectures at the same time for the same level, when both are in the same
 *             department or either is a common course. Courses sharing one booking
 *             ("CSC308/CSC411") are taught together and never clash with each other.
 * - lecturer: one lecturer assigned to two lectures that overlap.
 * - jumat:    a course lecture running into the Friday 1–2 p.m. Jumat period (warning only).
 */
export function findClashes(bookings: readonly SlotLike[], ctx: ClashContext): Clash[] {
  const out: Clash[] = [];

  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      const a = bookings[i];
      const b = bookings[j];
      if (!overlaps(a, b)) continue;
      const when = `${DAYS[a.day]} ${SLOTS[Math.max(a.start, b.start)]}`;

      if (a.venueCode === b.venueCode) {
        out.push({
          type: "venue",
          severity: "error",
          bookingIds: [a.id, b.id],
          message: `Venue ${a.venueCode} is double-booked on ${when}: ${a.label} and ${b.label}.`,
        });
      }

      if (a.kind !== "course" || b.kind !== "course") continue;

      let students: [CourseInfo, CourseInfo] | null = null;
      let lecturer: [CourseInfo, CourseInfo, string] | null = null;
      for (const x of codesOf(a.label)) {
        for (const y of codesOf(b.label)) {
          if (x === y) continue;
          const X = courseInfo(x, ctx);
          const Y = courseInfo(y, ctx);
          if (
            !students &&
            X.level != null &&
            X.level === Y.level &&
            (X.isCommon || Y.isCommon || X.dept === Y.dept)
          ) {
            students = [X, Y];
          }
          if (!lecturer) {
            const shared = X.lecturerIds.find((id) => Y.lecturerIds.includes(id));
            if (shared) lecturer = [X, Y, shared];
          }
        }
      }

      if (students) {
        const [X, Y] = students;
        const why =
          X.isCommon || Y.isCommon
            ? `${(X.isCommon ? X : Y).code} is common to all ${levelName(X.level)} students`
            : `Both are ${X.dept} ${levelName(X.level)} courses`;
        out.push({
          type: "students",
          severity: "error",
          bookingIds: [a.id, b.id],
          message: `${levelName(X.level)} clash on ${when}: ${a.label} (${a.venueCode}) and ${b.label} (${b.venueCode}). ${why}.`,
        });
      }

      if (lecturer) {
        const [X, Y, id] = lecturer;
        const name = ctx.lecturerName?.(id) || "A lecturer";
        out.push({
          type: "lecturer",
          severity: "error",
          bookingIds: [a.id, b.id],
          message: `${name} is booked twice on ${when}: ${X.code} and ${Y.code}.`,
        });
      }
    }
  }

  for (const s of bookings) {
    if (s.kind === "course" && s.day === JUMAT.day && s.start <= JUMAT.slot && s.start + s.span > JUMAT.slot) {
      out.push({
        type: "jumat",
        severity: "warning",
        bookingIds: [s.id],
        message: `${s.label} (${s.venueCode}) runs into the Friday Jumat period, 1–2 p.m.`,
      });
    }
  }

  return out;
}

/** Index clashes by booking id for quick lookup while drawing the grid. */
export function clashesByBooking(clashes: readonly Clash[]): Map<string, Clash[]> {
  const m = new Map<string, Clash[]>();
  for (const c of clashes) for (const id of c.bookingIds) m.set(id, [...(m.get(id) ?? []), c]);
  return m;
}

/** Scheduled hours per course code (course lectures only). */
export function hoursByCourse(bookings: readonly SlotLike[]): Map<string, number> {
  const h = new Map<string, number>();
  for (const b of bookings) {
    if (b.kind !== "course") continue;
    for (const c of codesOf(b.label)) h.set(c, (h.get(c) ?? 0) + b.span);
  }
  return h;
}
