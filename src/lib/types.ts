import type { Kind } from "./timetable";

/** Plain, serialisable shapes passed from server components to client components. */

export interface VenueDTO {
  code: string;
  name: string;
  seats: number;
}

export interface BookingDTO {
  id: string;
  venueCode: string;
  day: number;
  start: number;
  span: number;
  label: string;
  kind: Kind;
  note: string;
}

export interface CourseDTO {
  code: string;
  title: string | null;
  level: number;
  dept: string;
  units: number | null;
  isCommon: boolean;
  lecturerIds: string[];
}

export interface LecturerDTO {
  id: string;
  name: string;
  dept: string | null;
}

export interface SemesterDTO {
  id: number;
  session: string;
  name: string;
}

export interface TimetableData {
  semester: SemesterDTO | null;
  venues: VenueDTO[];
  bookings: BookingDTO[];
  courses: CourseDTO[];
  lecturers: LecturerDTO[];
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
