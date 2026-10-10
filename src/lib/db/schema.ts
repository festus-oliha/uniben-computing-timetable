import {
  boolean,
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
});

/** Lecture halls and labs: T, W, E, P1, P2, P4 … */
export const venues = pgTable("venues", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  seats: integer("seats").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
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
