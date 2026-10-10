import { describe, expect, it } from "vitest";
import { defaultTemplate, fits, programmeIssues, semesterNumber, slotText, timeRange, unscheduledCourses, type PSlot } from "./programme";

const pt = defaultTemplate("pt");
let n = 0;
const s = (x: Partial<PSlot>): PSlot => ({ id: `s${++n}`, day: 6, group: 1, start: 0, span: 1, label: "CSC111", kind: "course", venue: "B", note: "", ...x });
const ctx = {
  periods: pt.periods,
  groups: pt.groups,
  venueKey: pt.venueKey,
  lecturersOf: (c: string) => (c === "CSC111" || c === "CSC211" ? ["kon"] : []),
  name: (id: string) => (id === "kon" ? "Dr. Konyeha" : id),
};

describe("programme templates", () => {
  it("starts part-time on Friday and Saturday, Years 1–6, with a 1:00–1:30 break", () => {
    expect(pt.days).toEqual([5, 6]);
    expect(pt.groups).toHaveLength(6);
    expect(pt.periods.filter((p) => p.isBreak).map((p) => p.label)).toEqual(["1:00P.M. – 1:30P.M."]);
    const msc = defaultTemplate("msc");
    expect(msc.days).toEqual([1, 2, 3, 4, 5]);
    expect(msc.periods.map((p) => p.label)).toEqual(["9am – 12pm", "1:00pm – 4:00pm"]);
  });

  it("keeps classes clear of the break", () => {
    expect(fits(pt.periods, 3, 2)).toBe(true);
    expect(fits(pt.periods, 4, 2)).toBe(false); // 12–1 then the break
    expect(fits(pt.periods, 5, 1)).toBe(false);
    expect(fits(pt.periods, 9, 2)).toBe(false); // past 5:30
  });

  it("joins period times", () => {
    expect(timeRange(pt.periods, 0, 2)).toBe("8:00A.M. – 10:00A.M.");
    expect(timeRange(pt.periods, 8, 2)).toBe("3:30P.M. – 5:30P.M.");
    expect(slotText({ label: "COS101/CSC110", venue: "A" })).toBe("COS101/CSC110(A)");
  });
});

describe("programme clash checks", () => {
  it("flags one year group, venue or lecturer twice at once", () => {
    const issues = programmeIssues([s({ start: 0, span: 2 }), s({ start: 1, label: "CHM111", venue: "B" }), s({ group: 2, start: 1, label: "CSC211", venue: "C" })], ctx);
    expect(issues.map((i) => i.type).sort()).toEqual(["group", "lecturer", "venue"]);
    expect(issues.find((i) => i.type === "lecturer")?.message).toMatch(/Konyeha teaches CSC111 and CSC211/);
  });

  it("lets activities share a venue and flags unknown venues", () => {
    const issues = programmeIssues([s({ group: 3, start: 7, label: "PRACTICAL", kind: "activity", venue: "" }), s({ group: 4, start: 7, label: "PRACTICAL", kind: "activity", venue: "" }), s({ start: 2, venue: "Z" })], ctx);
    expect(issues.map((i) => i.type)).toEqual(["venueKey"]);
  });

  it("lists allocated courses not yet on the timetable", () => {
    const courses = [
      { id: "1", code: "CSC111", title: "", category: "core" as const, semester: 1, lecturerIds: [] },
      { id: "2", code: "CSC803", title: "", category: "core" as const, semester: 1, lecturerIds: [] },
      { id: "3", code: "CSC802", title: "", category: "core" as const, semester: 2, lecturerIds: [] },
    ];
    expect(unscheduledCourses(courses, [s({})], 1)).toEqual(["CSC803"]);
    expect(semesterNumber("Second Semester")).toBe(2);
  });
});
