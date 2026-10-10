import { describe, expect, it } from "vitest";
import { publicEntries, timeRange } from "./public-view";
import type { BookingDTO, CourseDTO } from "./types";

const b = (p: Partial<BookingDTO>): BookingDTO => ({ id: Math.random().toString(36), venueCode: "P1", day: 0, start: 0, span: 2, label: "CSC401", kind: "course", note: "", ...p });
const c = (code: string, p: Partial<CourseDTO> = {}): CourseDTO => ({
  code,
  title: null,
  level: Number(code.match(/(\d)\d\d$/)![1]),
  dept: code.slice(0, 3),
  units: null,
  isCommon: false,
  lecturerIds: [],
  ...p,
});

const data = (bookings: BookingDTO[], courses: CourseDTO[]) => ({
  bookings,
  courses,
  lecturers: [{ id: "L1", name: "Dr. Ada", dept: "CSC" }],
  venues: [{ code: "P1", name: "400 Level CSC Class", seats: 120 }, { code: "T", name: "1000 LT", seats: 1000 }],
});

describe("public timetable", () => {
  it("formats clock times, including the 2:30 afternoon start", () => {
    expect(timeRange(0, 2)).toBe("8:00 am – 10:00 am");
    expect(timeRange(4, 2)).toBe("12:00 pm – 2:00 pm");
    expect(timeRange(6, 1)).toBe("2:30 pm – 3:30 pm");
  });

  it("gives a class its own department's courses plus the level's common courses", () => {
    const d = data(
      [b({ label: "CSC401" }), b({ label: "DTS304" }), b({ label: "COS409", day: 1 }), b({ label: "CSC308/CSC411", day: 2 }), b({ label: "IFT442" })],
      [c("CSC401"), c("DTS304"), c("COS409", { isCommon: true }), c("CSC308"), c("CSC411"), c("IFT442")],
    );
    const got = publicEntries({ kind: "class", level: 4, dept: "CSC" }, d).map((e) => e.label);
    expect(got).toEqual(["CSC401", "COS409", "CSC308/CSC411"]);
  });

  it("never shows other faculties' bookings or part-time periods", () => {
    const d = data([b({ kind: "shared", label: "CHM201", venueCode: "T" }), b({ kind: "pt", label: "PT", venueCode: "T" }), b({ kind: "activity", label: "Mathematics Tutorial", venueCode: "T" })], []);
    expect(publicEntries({ kind: "venue", venue: "T" }, d).map((e) => e.label)).toEqual(["Mathematics Tutorial"]);
  });

  it("finds a lecturer's lectures", () => {
    const d = data([b({ label: "CSC401" }), b({ label: "CSC424", day: 3 })], [c("CSC401", { lecturerIds: ["L1"] }), c("CSC424")]);
    const got = publicEntries({ kind: "lecturer", lecturerId: "L1" }, d);
    expect(got.map((e) => e.label)).toEqual(["CSC401"]);
    expect(got[0].lecturers).toEqual(["Dr. Ada"]);
  });

  it("sorts by day, then time", () => {
    const d = data([b({ label: "CSC402", day: 2 }), b({ label: "CSC401", day: 0, start: 4 }), b({ label: "CSC413", day: 0, start: 0 })], [c("CSC402"), c("CSC401"), c("CSC413")]);
    expect(publicEntries({ kind: "class", level: 4, dept: "CSC" }, d).map((e) => e.label)).toEqual(["CSC413", "CSC401", "CSC402"]);
  });
});
