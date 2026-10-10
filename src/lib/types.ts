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
  isPublished: boolean;
}

export interface TimetableData {
  semester: SemesterDTO | null;
  venues: VenueDTO[];
  bookings: BookingDTO[];
  courses: CourseDTO[];
  lecturers: LecturerDTO[];
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/* ---------- examinations ---------- */

export interface ExamSessionDTO {
  name: string;
  time: string;
}

export interface ExamTimetableDTO {
  id: number;
  semesterId: number;
  programme: string;
  dept: string | null;
  title: string;
  sessions: ExamSessionDTO[];
  dates: string[];
  notes: string[];
  signatoryName: string;
  signatoryRole: string;
  isPublished: boolean;
  signedOn: string | null;
  hasSignature: boolean;
}

export interface ExamPaperDTO {
  id: string;
  date: string;
  session: number;
  label: string;
  kind: "paper" | "block";
  venues: string[];
  year: string | null;
  note: string;
  chiefId: string | null;
  invigilatorIds: string[];
}

export interface ExamVenueDTO extends VenueDTO {
  inLectureGrid: boolean;
}

export interface ExamBoardData {
  semester: SemesterDTO;
  timetable: ExamTimetableDTO;
  papers: ExamPaperDTO[];
  venues: ExamVenueDTO[];
  courses: CourseDTO[];
  lecturers: LecturerDTO[];
  /** Courses on this semester's lecture timetable — each should get an examination. */
  taughtCodes: string[];
}
