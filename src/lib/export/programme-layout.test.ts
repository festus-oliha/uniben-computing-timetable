import { describe, expect, it } from "vitest";
import { buildProgrammeDoc } from "./programme-layout";
import { defaultTemplate, type PSlot } from "../programme";
import type { ProgrammeTimetableDTO } from "../types";

const tpl = defaultTemplate("pt");
const t: ProgrammeTimetableDTO = { id: 1, semesterId: 1, programme: "pt", dept: "CSC", title: "PT", ...tpl, signatoryName: "Mr. I. E. Obayagbona", signatoryRole: "Departmental Time-Table Officer", isPublished: false, signedOn: null };
const s = (x: Partial<PSlot>): PSlot => ({ id: Math.random().toString(), day: 6, group: 1, start: 0, span: 2, label: "CSC111", kind: "course", venue: "B", note: "", ...x });

describe("programme document", () => {
  it("lays each row out across the periods with the break in place", () => {
    const d = buildProgrammeDoc(t, [s({}), s({ start: 6, label: "CSC211" }), s({ start: 8, span: 1, label: "PRACTICAL", kind: "activity", venue: "" })], [], []);
    const row = d.rows.find((r) => r.day === "SATURDAY" && r.group === "YEAR 2")!;
    expect(row.cells.map((c) => c.type)).toEqual(["slot", "empty", "empty", "empty", "break", "slot", "slot", "empty"]);
    expect(row.cells[0]).toMatchObject({ text: "CSC111(B)", span: 2 });
    expect(d.rows).toHaveLength(12); // 2 days × 6 years
    expect(d.landscape).toBe(true);
  });

  it("keeps clashing classes visible", () => {
    const d = buildProgrammeDoc(t, [s({}), s({ start: 1, span: 1, label: "CHM111" })], [], []);
    const row = d.rows.find((r) => r.day === "SATURDAY" && r.group === "YEAR 2")!;
    expect(row.cells[0]).toMatchObject({ text: "CSC111(B) · CHM111(B)" });
  });

  it("prints the course allocation with marks and lecturers", () => {
    const d = buildProgrammeDoc(t, [], [{ id: "1", code: "CSC801", title: "Current Topics in Computer Systems", category: "core", semester: 1, lecturerIds: ["a"] }], [{ id: "a", name: "Prof. F. I. Imuoukhuome", dept: "CSC" }]);
    expect(d.allocation).toEqual([{ semester: "First Semester", lines: ["*CSC801: Current Topics in Computer Systems [Prof. F. I. Imuoukhuome]"] }]);
  });
});
