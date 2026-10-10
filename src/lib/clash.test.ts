import { describe, expect, it } from "vitest";
import { findClashes, hoursByCourse, type CourseInfo, type SlotLike } from "./clash";
import { codesOf, fitsInBlock, levelOf } from "./timetable";

let n = 0;
const slot = (p: Partial<SlotLike>): SlotLike => ({
  id: `b${++n}`,
  venueCode: "T",
  day: 0,
  start: 0,
  span: 1,
  label: "CSC301",
  kind: "course",
  ...p,
});

const course = (code: string, extra: Partial<CourseInfo> = {}): [string, CourseInfo] => [
  code,
  { code, level: levelOf(code), dept: code.slice(0, 3), isCommon: false, lecturerIds: [], ...extra },
];

const ctx = (...cs: [string, CourseInfo][]) => ({ courses: new Map(cs) });

describe("helpers", () => {
  it("splits paired labels into course codes", () => {
    expect(codesOf("CSC308/CSC411")).toEqual(["CSC308", "CSC411"]);
    expect(codesOf("csc309 / CSC415")).toEqual(["CSC309", "CSC415"]);
    expect(codesOf("Mathematics Tutorial")).toEqual([]);
  });

  it("never lets a booking cross the 2:00 break", () => {
    expect(fitsInBlock(4, 2)).toBe(true); // 12–2
    expect(fitsInBlock(5, 2)).toBe(false); // 1–2 then 2:30 …
    expect(fitsInBlock(7, 3)).toBe(true); // 3:30–6:30
    expect(fitsInBlock(8, 3)).toBe(false);
  });
});

describe("venue clashes", () => {
  it("flags two bookings in the same room at the same time", () => {
    const r = findClashes([slot({ venueCode: "P1", start: 0, span: 2 }), slot({ venueCode: "P1", start: 1, label: "DTS101" })], ctx());
    expect(r.map((c) => c.type)).toContain("venue");
  });

  it("counts other faculties' bookings too", () => {
    const r = findClashes([slot({ venueCode: "W" }), slot({ venueCode: "W", label: "CHM201", kind: "shared" })], ctx());
    expect(r.filter((c) => c.type === "venue")).toHaveLength(1);
  });

  it("ignores back-to-back bookings", () => {
    const r = findClashes([slot({ start: 0, span: 2 }), slot({ start: 2, label: "CSC312" })], ctx());
    expect(r).toHaveLength(0);
  });
});

describe("student clashes", () => {
  it("flags a common course against any course at the same level (COS101 vs DTS101)", () => {
    const r = findClashes(
      [slot({ venueCode: "T", start: 3, label: "COS101" }), slot({ venueCode: "P4", start: 2, span: 2, label: "DTS101" })],
      ctx(course("COS101", { isCommon: true }), course("DTS101")),
    );
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe("students");
    expect(r[0].message).toContain("COS101 is common to all 100 Level students");
  });

  it("flags two courses of the same department and level", () => {
    const r = findClashes(
      [slot({ venueCode: "P1", label: "CSC401/CSC418" }), slot({ venueCode: "P2", label: "CSC308/CSC411" })],
      ctx(),
    );
    expect(r.map((c) => c.type)).toEqual(["students"]);
  });

  it("allows different departments at the same level when neither is common", () => {
    const r = findClashes([slot({ venueCode: "W", label: "CYB201" }), slot({ venueCode: "P2", label: "ICT203" })], ctx());
    expect(r).toHaveLength(0);
  });

  it("allows different levels at the same time", () => {
    const r = findClashes([slot({ venueCode: "W", label: "CSC201" }), slot({ venueCode: "P2", label: "CSC312" })], ctx());
    expect(r).toHaveLength(0);
  });

  it("ignores tutorials, part-time periods and other faculties for student clashes", () => {
    const r = findClashes(
      [slot({ venueCode: "T", label: "Mathematics Tutorial", kind: "activity" }), slot({ venueCode: "P4", label: "CYB111" })],
      ctx(),
    );
    expect(r).toHaveLength(0);
  });
});

describe("lecturer clashes", () => {
  it("flags one lecturer in two places at once", () => {
    const r = findClashes(
      [slot({ venueCode: "P1", label: "CSC424" }), slot({ venueCode: "W", label: "DTS201" })],
      {
        courses: new Map([course("CSC424", { lecturerIds: ["L1"] }), course("DTS201", { lecturerIds: ["L1"] })]),
        lecturerName: () => "Dr. Test",
      },
    );
    expect(r).toHaveLength(1);
    expect(r[0].message).toContain("Dr. Test");
  });
});

describe("Jumat", () => {
  it("warns when a lecture runs into Friday 1–2", () => {
    const r = findClashes([slot({ day: 4, start: 4, span: 2, label: "CYB102" })], ctx());
    expect(r).toEqual([expect.objectContaining({ type: "jumat", severity: "warning" })]);
  });
});

describe("hoursByCourse", () => {
  it("counts each code in a paired booking", () => {
    const h = hoursByCourse([slot({ span: 2, label: "CSC308/CSC411" }), slot({ day: 4, label: "CSC308/CSC411" })]);
    expect(h.get("CSC308")).toBe(3);
    expect(h.get("CSC411")).toBe(3);
  });
});
