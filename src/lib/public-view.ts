import { codesOf } from "./timetable";
import type { BookingDTO, CourseDTO, LecturerDTO, VenueDTO } from "./types";

/** What a visitor asked to see on the public page. */
export type PublicFilter =
  | { kind: "class"; level: number; dept: string }
  | { kind: "lecturer"; lecturerId: string }
  | { kind: "venue"; venue: string };

export interface PublicEntry {
  id: string;
  day: number;
  start: number;
  span: number;
  label: string;
  venue: VenueDTO | undefined;
  lecturers: string[];
  isCommon: boolean;
  activity: boolean;
}

/** Clock time a slot starts: 0 → 8:00 … 5 → 13:00, 6 → 14:30 … 9 → 17:30 (minutes after midnight). */
const SLOT_START_MIN = [480, 540, 600, 660, 720, 780, 870, 930, 990, 1050];

function clock(min: number) {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const h = ((h24 + 11) % 12) + 1;
  return `${h}:${String(m).padStart(2, "0")}${h24 < 12 ? " am" : " pm"}`;
}

/** "10:00 am – 12:00 pm" */
export function timeRange(start: number, span: number) {
  const from = SLOT_START_MIN[start];
  return `${clock(from)} – ${clock(from + span * 60)}`;
}

/**
 * The bookings a visitor should see, in day and time order.
 * - class:    course lectures with a course at that level in that department, plus that level's common courses.
 * - lecturer: course lectures for courses assigned to that lecturer.
 * - venue:    everything held in that venue except other faculties' bookings and part-time periods.
 */
export function publicEntries(
  filter: PublicFilter,
  data: { bookings: BookingDTO[]; courses: CourseDTO[]; lecturers: LecturerDTO[]; venues: VenueDTO[] },
): PublicEntry[] {
  const course = new Map(data.courses.map((c) => [c.code, c]));
  const lecName = new Map(data.lecturers.map((l) => [l.id, l.name]));
  const venue = new Map(data.venues.map((v) => [v.code, v]));

  const keep = (b: BookingDTO): boolean => {
    if (b.kind === "shared" || b.kind === "pt") return false;
    if (filter.kind === "venue") return b.venueCode === filter.venue;
    if (b.kind !== "course") return false;
    const cs = codesOf(b.label).map((c) => course.get(c)).filter(Boolean) as CourseDTO[];
    if (filter.kind === "lecturer") return cs.some((c) => c.lecturerIds.includes(filter.lecturerId));
    return cs.some((c) => c.level === filter.level && (c.dept === filter.dept || c.isCommon));
  };

  return data.bookings
    .filter(keep)
    .map((b) => {
      const cs = codesOf(b.label).map((c) => course.get(c)).filter(Boolean) as CourseDTO[];
      return {
        id: b.id,
        day: b.day,
        start: b.start,
        span: b.span,
        label: b.label,
        venue: venue.get(b.venueCode),
        lecturers: [...new Set(cs.flatMap((c) => c.lecturerIds))].map((id) => lecName.get(id)).filter(Boolean) as string[],
        isCommon: cs.some((c) => c.isCommon),
        activity: b.kind === "activity",
      };
    })
    .sort((a, b) => a.day - b.day || a.start - b.start || a.label.localeCompare(b.label));
}
