import { describe, expect, it } from "vitest";
import { dateLabel, datesBetween, examEntries, examIssues, paperText, parseVenues, sessionNumber, unscheduled, weekOf, type PaperLike } from "./exam";

let n = 0;
const p = (x: Partial<PaperLike>): PaperLike => ({ id: `p${++n}`, date: "2026-03-16", session: 0, label: "CSC311", kind: "paper", venues: ["T"], year: null, chiefId: null, invigilatorIds: [], ...x });
const ctx = (common: string[] = []) => ({
  course: (c: string) => ({ level: Number(c.match(/(\d)\d\d$/)![1]), dept: c.slice(0, 3), isCommon: common.includes(c) }),
  lecturerName: (id: string) => ({ L1: "Dr. Osaseri" })[id],
});

describe("exam dates and labels", () => {
  it("labels dates the way the printed timetable does", () => {
    expect(dateLabel("2026-03-16")).toMatchObject({ day: "Mon.", date: "16/03/26", long: "Monday" });
    expect(dateLabel("2026-03-21").day).toBe("Sat.");
  });

  it("lists exam dates on chosen weekdays only", () => {
    expect(datesBetween("2026-05-15", "2026-05-30", [5, 6])).toEqual(["2026-05-15", "2026-05-16", "2026-05-22", "2026-05-23", "2026-05-29", "2026-05-30"]);
    expect(datesBetween("2026-03-16", "2026-03-22", [1, 2, 3, 4, 5, 6])).toHaveLength(6);
  });

  it("numbers sessions across the timetable", () => {
    expect(sessionNumber(0, 0, 3)).toBe(1);
    expect(sessionNumber(1, 2, 3)).toBe(6);
    expect(sessionNumber(16, 2, 3)).toBe(51);
  });

  it("reads and prints venues", () => {
    expect(parseVenues("W, t,P1 ; P2 W")).toEqual(["W", "T", "P1", "P2"]);
    expect(paperText({ label: "CSC313/CSC301", kind: "paper", venues: ["T"], year: null })).toBe("CSC313/CSC301 (T)");
    expect(paperText({ label: "CHM111", kind: "paper", venues: ["T"], year: "Y2" })).toBe("CHM111 (Y2, T)");
    expect(paperText({ label: "GST", kind: "block", venues: [], year: null })).toBe("GST");
  });

  it("groups dates into weeks", () => {
    const dates = ["2026-05-15", "2026-05-16", "2026-05-22", "2026-05-23"];
    expect(dates.map((d) => weekOf(dates, d))).toEqual([1, 1, 2, 2]);
  });
});

describe("exam clashes", () => {
  it("flags the same students in one session", () => {
    const r = examIssues([p({ label: "COS101" }), p({ label: "DTS101" })], ctx(["COS101"]));
    expect(r).toEqual([expect.objectContaining({ type: "students", severity: "error" })]);
  });

  it("allows different departments at the same level in one session", () => {
    expect(examIssues([p({ label: "CYB102" }), p({ label: "IFT103" })], ctx())).toEqual([]);
  });

  it("warns when the same students have two papers in one day", () => {
    const r = examIssues([p({ label: "CSC311", session: 0 }), p({ label: "CSC312", session: 2 })], ctx());
    expect(r).toEqual([expect.objectContaining({ type: "sameDay", severity: "warning" })]);
  });

  it("uses part-time year groups when given", () => {
    expect(examIssues([p({ label: "CSC313", year: "Y4" }), p({ label: "MTH317", year: "Y4" })], ctx())[0].type).toBe("students");
    expect(examIssues([p({ label: "CSC313", year: "Y4" }), p({ label: "CSC414", year: "Y6" })], ctx())).toEqual([]);
  });

  it("flags a course examined twice", () => {
    const r = examIssues([p({ label: "CSC311" }), p({ label: "CSC311", date: "2026-03-20" })], ctx());
    expect(r.map((x) => x.type)).toContain("duplicate");
  });

  it("flags an invigilator in two places at once", () => {
    const r = examIssues([p({ label: "CSC311", chiefId: "L1" }), p({ label: "DTS201", invigilatorIds: ["L1"] })], ctx());
    expect(r).toEqual([expect.objectContaining({ type: "invigilator", message: expect.stringContaining("Dr. Osaseri") })]);
  });

  it("ignores GST/CED blocks", () => {
    expect(examIssues([p({ label: "GST", kind: "block" }), p({ label: "CSC311" })], ctx())).toEqual([]);
  });

  it("lists taught courses with no exam yet", () => {
    expect(unscheduled(["CSC311", "CSC312", "CSC313"], [p({ label: "CSC313/CSC301" }), p({ label: "CSC311" })])).toEqual(["CSC312"]);
  });
});

describe("public examination lists", () => {
  const mk = (id: string, label: string, date: string, session = 0, extra: Partial<PaperLike> = {}): PaperLike => ({ id, label, date, session, kind: "paper", venues: [], year: null, chiefId: null, invigilatorIds: [], ...extra });
  const course = (c: string) => (c === "COS301" ? { level: 3, dept: "COS", isCommon: true } : undefined);
  const papers = [mk("a", "CSC313", "2026-07-28"), mk("b", "COS301", "2026-07-27", 1), mk("c", "DTS301", "2026-07-27"), mk("d", "GST", "2026-07-27", 2, { kind: "block" }), mk("e", "CSC411", "2026-07-29")];

  it("shows a class its own and common papers, in date order", () => {
    expect(examEntries({ kind: "class", level: 3, dept: "CSC" }, papers, course).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("filters part-time papers by year group", () => {
    const pt = [mk("x", "CHM111", "2026-03-13", 0, { year: "Y2" }), mk("y", "MTH111", "2026-03-13", 1, { year: "Y1" })];
    expect(examEntries({ kind: "year", year: "Y2" }, pt, course).map((p) => p.id)).toEqual(["x"]);
  });

  it("shows everything for the whole timetable", () => {
    expect(examEntries({ kind: "all" }, papers, course)).toHaveLength(5);
  });
});
