import { describe, expect, it } from "vitest";
import { buildInvigilationDoc, invigilationTitle } from "./invigilation-layout";
import type { ExamPaperDTO, ExamTimetableDTO } from "../types";

const t: ExamTimetableDTO = {
  id: 1, semesterId: 1, programme: "pt", dept: "CSC",
  title: "PART-TIME FIRST SEMESTER EXAMINATION TIMETABLE FOR THE 2025/2026 ACADEMIC SESSION",
  sessions: [{ name: "Morning Session", time: "8–11" }, { name: "Afternoon Session", time: "11:30–2:30" }],
  dates: ["2026-05-15", "2026-05-16", "2026-05-22"], notes: [], signatoryName: "I. E. Obayagbona", signatoryRole: "Time-Table Officer",
  isPublished: false, signedOn: null, hasSignature: false, invigilatorPool: null, assistantsPerPaper: 3, maxDutiesPerDay: 2, invigilationPublished: false, invSignedOn: null,
};
const p = (o: Partial<ExamPaperDTO>): ExamPaperDTO => ({ id: "x", date: "2026-05-16", session: 0, label: "CHM111", kind: "paper", venues: ["T"], year: "Y2", note: "", chiefId: null, invigilatorIds: [], assistantsNeeded: null, ...o });
const staff = [{ id: "e", name: "Dr. P. O. Egwali", dept: "CSC" }, { id: "o", name: "Dr. Osaseri", dept: "CSC" }, { id: "k", name: "Mr. Okhuoya", dept: "CSC", shortName: "OKHUOYA K." }];

describe("invigilation document", () => {
  it("prints paper, chief and assistants like the faculty's schedule", () => {
    const d = buildInvigilationDoc(t, [p({ chiefId: "e", invigilatorIds: ["o", "k"] })], staff, [{ code: "T", name: "1000 Lecture Theatre" }]);
    const sat = d.rows.find((r) => r.type === "date" && r.day === "Saturday");
    if (sat?.type !== "date") throw new Error();
    expect(sat.cells[0]).toMatchObject({ number: 3, lines: [{ paper: "CHM111 (Y2, T)", chief: "EGWALI", assistants: "OSASERI, OKHUOYA K." }] });
    expect(d.rows.filter((r) => r.type === "week")).toHaveLength(2);
    expect(d.heading[0]).toBe("DEPARTMENT OF COMPUTER SCIENCE");
    expect(d.levels).toEqual(["Y2 – Year Two"]);
    expect(d.venues).toEqual([{ code: "T", name: "1000 Lecture Theatre" }]);
  });

  it("lists each person's duties", () => {
    const d = buildInvigilationDoc(t, [p({ chiefId: "e", invigilatorIds: ["o"] }), p({ id: "y", label: "CSC111", date: "2026-05-22", chiefId: "o" })], staff, []);
    expect(d.duties.find((x) => x.id === "o")).toMatchObject({ chief: 1, assistant: 1, duties: ["Sat. 16/05/26 Morning: CHM111", "Fri. 22/05/26 Morning: CSC111 (chief)"] });
  });

  it("names the document an invigilation schedule", () => {
    expect(invigilationTitle(t.title)).toBe("PART-TIME FIRST SEMESTER EXAMINATION INVIGILATION SCHEDULE FOR THE 2025/2026 ACADEMIC SESSION");
  });
});
