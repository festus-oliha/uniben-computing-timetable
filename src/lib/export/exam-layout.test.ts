import { describe, expect, it } from "vitest";
import { buildExamDoc } from "./exam-layout";
import type { ExamPaperDTO, ExamTimetableDTO } from "../types";

const t = (o: Partial<ExamTimetableDTO> = {}): ExamTimetableDTO => ({
  id: 1,
  semesterId: 1,
  programme: "ug",
  dept: null,
  title: "SECOND SEMESTER EXAMINATION TIMETABLE",
  sessions: [
    { name: "Morning Session", time: "8–11" },
    { name: "Afternoon Session", time: "11:30–2:30" },
    { name: "Evening Session", time: "3–6" },
  ],
  dates: ["2026-07-27", "2026-07-28"],
  notes: ["Note one"],
  signatoryName: "F. O. Oliha, PhD.",
  signatoryRole: "Faculty of Computing Time-Table Officer",
  isPublished: false,
  signedOn: null,
  hasSignature: false,
  ...o,
});
const p = (o: Partial<ExamPaperDTO>): ExamPaperDTO => ({ id: "x", date: "2026-07-27", session: 0, label: "CSC421", kind: "paper", venues: [], year: null, note: "", chiefId: null, invigilatorIds: [], ...o });
const venues = [
  { code: "T", name: "1000 LT" },
  { code: "W", name: "500 LT" },
  { code: "Z", name: "Seminar Room" },
];

describe("examination document", () => {
  it("numbers sessions across the whole timetable and prints papers with their venues", () => {
    const d = buildExamDoc(t(), [p({ session: 1, venues: ["T"] }), p({ id: "y", date: "2026-07-28", session: 2, label: "COS202", venues: ["W", "T"] })], venues);
    const rows = d.rows.filter((r) => r.type === "date");
    expect(rows).toHaveLength(2);
    if (rows[1].type !== "date") throw new Error();
    expect(rows[1].cells.map((c) => c.number)).toEqual([4, 5, 6]);
    expect(rows[1].cells[2].lines[0].text).toBe("COS202 (W, T)");
    expect(rows[1].day).toBe("Tue.");
  });

  it("keys only the venues actually used, in venue order", () => {
    const d = buildExamDoc(t(), [p({ venues: ["W"] }), p({ id: "z", venues: ["T", "W"] })], venues);
    expect(d.venues.map((v) => v.code)).toEqual(["T", "W"]);
  });

  it("groups part-time dates by week and uses the department's distribution", () => {
    const d = buildExamDoc(t({ programme: "pt", dept: "CSC", dates: ["2026-03-13", "2026-03-14", "2026-03-20"] }), [], venues);
    expect(d.rows.filter((r) => r.type === "week").map((r) => (r.type === "week" ? r.label : ""))).toEqual(["WEEK 1", "WEEK 2"]);
    expect(d.department).toBe("DEPARTMENT OF COMPUTER SCIENCE");
    expect(d.signatory.forWhom).toBeNull();
  });
});
