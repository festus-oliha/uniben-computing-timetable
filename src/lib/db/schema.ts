import {
  boolean,
  jsonb,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** An academic session + semester, e.g. 2026/2027 First Semester. Bookings belong to one. */
export const semesters = pgTable("semesters", {
  id: serial("id").primaryKey(),
  session: text("session").notNull(), // "2026/2027"
  name: text("name").notNull(), // "First Semester"
  isCurrent: boolean("is_current").notNull().default(false),
  /** Sign-off by the Faculty Time-Table Officer: the date printed after "Signed" (YYYY-MM-DD). */
  signedOn: text("signed_on"),
  /** The signature as a PNG/JPEG data URL (drawn on screen or uploaded), with its pixel size. */
  signatureImage: text("signature_image"),
  signatureWidth: integer("signature_width"),
  signatureHeight: integer("signature_height"),
  signatureUpdatedAt: timestamp("signature_updated_at", { withTimezone: true }),
  /** When true, the public timetable page (/view) shows this semester to students and lecturers. */
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

/** Lecture halls and labs: T, W, E, P1, P2, P4 … */
export const venues = pgTable("venues", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  seats: integer("seats").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  /** False for venues used only for examinations (e.g. F, G, M labs) — they don't get a row on the lecture grid. */
  inLectureGrid: boolean("in_lecture_grid").notNull().default(true),
});

/** Courses are shared across semesters. `dept` is the code prefix (CSC, CYB, DTS …). */
export const courses = pgTable("courses", {
  code: text("code").primaryKey(),
  title: text("title"),
  level: integer("level").notNull(),
  dept: text("dept").notNull(),
  units: integer("units"),
  /** Taken by every department at this level (COS, GST, CED …). */
  isCommon: boolean("is_common").notNull().default(false),
});

export const lecturers = pgTable("lecturers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  dept: text("dept"),
  /** How the name prints on invigilation schedules, e.g. "OSASERI". Empty = surname in capitals. */
  shortName: text("short_name"),
});

export const courseLecturers = pgTable(
  "course_lecturers",
  {
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code, { onDelete: "cascade", onUpdate: "cascade" }),
    lecturerId: uuid("lecturer_id")
      .notNull()
      .references(() => lecturers.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.courseCode, t.lecturerId] })],
);

export const bookingKind = pgEnum("booking_kind", ["course", "activity", "pt", "shared"]);

/**
 * One block on the timetable.
 * day: 0 = Monday … 4 = Friday.
 * start: slot index 0–9 (0 = 8–9 a.m. … 5 = 1–2 p.m., 6 = 2:30–3:30 … 9 = 5:30–6:30).
 * span: number of one-hour slots. A booking never crosses the 2:00–2:30 break.
 * label: course code(s) — "CSC308/CSC411" for courses taught together — or free text for activities.
 */
export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  semesterId: integer("semester_id")
    .notNull()
    .references(() => semesters.id, { onDelete: "cascade" }),
  venueCode: text("venue_code")
    .notNull()
    .references(() => venues.code, { onUpdate: "cascade" }),
  day: integer("day").notNull(),
  start: integer("start").notNull(),
  span: integer("span").notNull().default(1),
  label: text("label").notNull(),
  kind: bookingKind("kind").notNull().default("course"),
  note: text("note").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Venue = typeof venues.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Lecturer = typeof lecturers.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingKind = (typeof bookingKind.enumValues)[number];

/* ---------- people & sign-in ---------- */

/**
 * admin        — Faculty Time-Table Officer: everything, including accounts and sign-off.
 * dept_officer — Departmental Time-Table Officer: their own department's courses, bookings and lecturers.
 * viewer       — can look and export, not change.
 */
export const userRole = pgEnum("user_role", ["admin", "dept_officer", "viewer"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(), // stored lower-case
  name: text("name").notNull(),
  role: userRole("role").notNull().default("viewer"),
  /** For dept_officer: the department code they manage (CSC, CYB, DTS, ICT, IFT, INS, SEN). */
  dept: text("dept"),
  passwordHash: text("password_hash").notNull(),
  /** Set when an admin creates or resets the account, so the person picks their own password. */
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

/** Signed-in browsers. The cookie holds a random token; only its SHA-256 hash is stored here. */
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type UserRole = (typeof userRole.enumValues)[number];

/* ---------- change history ---------- */

/** One line per change, written by the server actions. Names are copied in so history survives deleted accounts. */
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  userName: text("user_name").notNull(),
  /** e.g. "booking.move", "course.edit", "signoff.save" — see src/lib/audit.ts */
  action: text("action").notNull(),
  /** Plain-language description shown on the History page. */
  summary: text("summary").notNull(),
  semesterId: integer("semester_id").references(() => semesters.id, { onDelete: "set null" }),
});

export type AuditEntry = typeof auditLog.$inferSelect;

/* ---------- examinations ---------- */

/** One examination session column, e.g. { name: "Morning Session", time: "8.00A.M. – 11.00A.M." }. */
export type ExamSession = { name: string; time: string };

/**
 * An examination timetable: one per semester, programme and (for part-time / postgraduate) department.
 * programme: "ug" | "pt" | "msc" | "phd" | "pgd"; dept is null for the Faculty-wide undergraduate timetable.
 */
export const examTimetables = pgTable("exam_timetables", {
  id: serial("id").primaryKey(),
  semesterId: integer("semester_id")
    .notNull()
    .references(() => semesters.id, { onDelete: "cascade" }),
  programme: text("programme").notNull(),
  dept: text("dept"),
  title: text("title").notNull(),
  sessions: jsonb("sessions").$type<ExamSession[]>().notNull(),
  /** The examination dates, YYYY-MM-DD, in order. Empty dates still print (with their session numbers). */
  dates: jsonb("dates").$type<string[]>().notNull(),
  /** Numbered notes printed under the timetable (rules for candidates, venue notes …). */
  notes: jsonb("notes").$type<string[]>().notNull().default([]),
  /** Who signs this timetable, e.g. "F. O. Oliha, PhD." / "Faculty of Computing Time-Table Officer". */
  signatoryName: text("signatory_name").notNull().default(""),
  signatoryRole: text("signatory_role").notNull().default(""),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  signedOn: text("signed_on"),
  signatureImage: text("signature_image"),
  signatureWidth: integer("signature_width"),
  signatureHeight: integer("signature_height"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

  /* Invigilation schedule for this timetable */
  /** Who may be suggested as an assistant invigilator (lecturer ids). null = the usual list (the department's staff, or everyone for undergraduate). */
  invigilatorPool: jsonb("invigilator_pool").$type<string[] | null>(),
  assistantsPerPaper: integer("assistants_per_paper").notNull().default(3),
  maxDutiesPerDay: integer("max_duties_per_day").notNull().default(2),
  invigilationPublished: boolean("invigilation_published").notNull().default(false),
  invigilationPublishedAt: timestamp("invigilation_published_at", { withTimezone: true }),
  invSignedOn: text("inv_signed_on"),
  invSignatureImage: text("inv_signature_image"),
  invSignatureWidth: integer("inv_signature_width"),
  invSignatureHeight: integer("inv_signature_height"),
});

/**
 * One entry in an exam session: a paper ("CSC313/CSC301") or a whole-session block ("GST", "CED").
 * venues: venue codes, e.g. ["W","T","P1"]. year: part-time year group, e.g. "Y2".
 * chiefId / invigilatorIds: lecturers (filled in on the Invigilation screen).
 */
export const examPapers = pgTable("exam_papers", {
  id: uuid("id").primaryKey().defaultRandom(),
  timetableId: integer("timetable_id")
    .notNull()
    .references(() => examTimetables.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  session: integer("session").notNull(),
  label: text("label").notNull(),
  kind: text("kind").notNull().default("paper"),
  venues: jsonb("venues").$type<string[]>().notNull().default([]),
  year: text("year"),
  note: text("note").notNull().default(""),
  chiefId: uuid("chief_id").references(() => lecturers.id, { onDelete: "set null" }),
  invigilatorIds: jsonb("invigilator_ids").$type<string[]>().notNull().default([]),
  /** Assistant invigilators this paper needs; null = the timetable's usual number. */
  assistantsNeeded: integer("assistants_needed"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Someone who cannot invigilate on a date (session null = the whole day). */
export const examUnavailability = pgTable("exam_unavailability", {
  id: uuid("id").primaryKey().defaultRandom(),
  timetableId: integer("timetable_id")
    .notNull()
    .references(() => examTimetables.id, { onDelete: "cascade" }),
  lecturerId: uuid("lecturer_id")
    .notNull()
    .references(() => lecturers.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  session: integer("session"),
  reason: text("reason").notNull().default(""),
});

export type ExamTimetable = typeof examTimetables.$inferSelect;
export type ExamPaper = typeof examPapers.$inferSelect;

/* ---------- part-time and postgraduate lecture timetables ---------- */

/**
 * A department's part-time or postgraduate lecture timetable for one semester.
 * Rows are days × groups (e.g. Friday · YEAR 1); columns are this timetable's own periods.
 */
export const programmeTimetables = pgTable("programme_timetables", {
  id: serial("id").primaryKey(),
  semesterId: integer("semester_id")
    .notNull()
    .references(() => semesters.id, { onDelete: "cascade" }),
  programme: text("programme").notNull(),
  dept: text("dept").notNull(),
  title: text("title").notNull(),
  /** 0 = Sunday … 6 = Saturday */
  days: jsonb("days").$type<number[]>().notNull(),
  groups: jsonb("groups").$type<string[]>().notNull(),
  periods: jsonb("periods").$type<{ label: string; isBreak?: boolean }[]>().notNull(),
  /** Venue letters used on this timetable, e.g. { code: "A", name: "1000 LT" } */
  venueKey: jsonb("venue_key").$type<{ code: string; name: string }[]>().notNull().default([]),
  calendar: jsonb("calendar").$type<{ weeks: string; dates: string; activity: string }[]>().notNull().default([]),
  notes: jsonb("notes").$type<string[]>().notNull().default([]),
  signatoryName: text("signatory_name").notNull().default(""),
  signatoryRole: text("signatory_role").notNull().default(""),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  signedOn: text("signed_on"),
  signatureImage: text("signature_image"),
  signatureWidth: integer("signature_width"),
  signatureHeight: integer("signature_height"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One class or activity (FREE, PRACTICAL, TUTORIALS …) on a programme timetable. */
export const programmeSlots = pgTable("programme_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  timetableId: integer("timetable_id")
    .notNull()
    .references(() => programmeTimetables.id, { onDelete: "cascade" }),
  day: integer("day").notNull(),
  group: integer("group_index").notNull().default(0),
  start: integer("start").notNull(),
  span: integer("span").notNull().default(1),
  label: text("label").notNull(),
  kind: text("kind").notNull().default("course"),
  venue: text("venue").notNull().default(""),
  note: text("note").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** The course allocation list printed with a programme timetable (both semesters for M.Sc.). */
export const programmeCourses = pgTable("programme_courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  timetableId: integer("timetable_id")
    .notNull()
    .references(() => programmeTimetables.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  title: text("title").notNull().default(""),
  /** "core" | "mandatory" | "elective" | "" */
  category: text("category").notNull().default(""),
  semester: integer("semester").notNull().default(1),
  lecturerIds: jsonb("lecturer_ids").$type<string[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type ProgrammeTimetable = typeof programmeTimetables.$inferSelect;
