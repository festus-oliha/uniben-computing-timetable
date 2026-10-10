import { describe, expect, it } from "vitest";
import { printLayout } from "./layout";
import type { BookingDTO, TimetableData } from "../types";

const b = (p: Partial<BookingDTO>): BookingDTO => ({
  id: Math.random().toString(36),
  venueCode: "T",
  day: 0,
  start: 0,
  span: 1,
  label: "CSC301",
  kind: "course",
  note: "",
  ...p,
});

const data = (bookings: BookingDTO[]): TimetableData => ({
  semester: { id: 1, session: "2026/2027", name: "First Semester" },
  venues: [{ code: "T", name: "1000 LT", seats: 1000 }],
  bookings,
  courses: [],
  lecturers: [],
});

describe("printLayout", () => {
  it("prints one row per day for each venue, in order", () => {
    const [t] = printLayout(data([]));
    expect(t.rows.map((r) => r.day)).toEqual([0, 1, 2, 3, 4]);
  });

  it("leaves other faculties' bookings blank", () => {
    const [t] = printLayout(data([b({ kind: "shared", label: "CHM201" })]));
    expect(t.rows[0].cells).toEqual([]);
  });

  it("labels part-time periods", () => {
    const [t] = printLayout(data([b({ kind: "pt", label: "PT", start: 7, span: 3 })]));
    expect(t.rows[0].cells[0]).toMatchObject({ text: "PART-TIME (PT)", start: 7, span: 3 });
  });

  it("shows both courses when two overlap in one venue", () => {
    const [t] = printLayout(data([b({ start: 0, span: 2, label: "CSC301" }), b({ start: 1, label: "DTS101" })]));
    expect(t.rows[0].cells).toEqual([expect.objectContaining({ start: 0, span: 2, text: "CSC301 / DTS101" })]);
  });
});
