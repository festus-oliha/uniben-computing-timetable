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
