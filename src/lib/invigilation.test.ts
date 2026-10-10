import { describe, expect, it } from "vitest";
import { dutyCounts, eligibility, invigilationIssues, printName, shortNameOf, suggestAssistants, type InvCtx, type InvPaper } from "./invigilation";

let n = 0;
const p = (x: Partial<InvPaper>): InvPaper => ({ id: `p${++n}`, date: "2026-05-15", session: 0, label: "CSC111", kind: "paper", venues: ["T"], year: null, chiefId: null, invigilatorIds: [], assistantsNeeded: null, ...x });
const names: Record<string, string> = { egw: "Dr. P. O. Egwali", osa: "Dr. Osaseri", okh: "Mr. Okhuoya", edo: "Mrs. Edosomwan", isi: "Dr. Isimah", kon: "Dr. Konyeha" };
const ctx = (o: Partial<InvCtx> = {}): InvCtx => ({
  lecturersOf: (c) => (c === "CSC111" ? ["kon"] : c === "CHM111" ? ["egw"] : []),
  name: (id) => names[id] ?? id,
  unavailable: [],
  settings: { assistantsPerPaper: 2, maxPerDay: 2 },
  ...o,
});

describe("print names", () => {
  it("prints surnames in capitals", () => {
    expect(shortNameOf("Dr. P. O. Egwali")).toBe("EGWALI");
    expect(shortNameOf("Prof. (Mrs.) F. Imianvan")).toBe("IMIANVAN");
    expect(shortNameOf("Egwali, P. O.")).toBe("EGWALI");
    expect(shortNameOf("Ikharo")).toBe("IKHARO");
    expect(printName({ name: "Dr. A. Smith", shortName: "SMITH A." })).toBe("SMITH A.");
  });
});

describe("invigilation rules", () => {
  it("never lets a course lecturer be the chief on their own paper", () => {
    const a = p({ label: "CSC111", chiefId: "kon" });
    const issues = invigilationIssues([a], ctx());
    expect(issues.find((i) => i.type === "ownCourse")?.message).toMatch(/Konyeha lectures CSC111/);
    expect(eligibility("kon", "chief", a, [a], ctx()).hard).toMatch(/lectures CSC111/);
    expect(eligibility("kon", "assistant", a, [a], ctx()).hard).toBeNull();
  });

  it("flags one person in two papers at once, and unavailable people", () => {
    const a = p({ label: "CSC111", chiefId: "osa", invigilatorIds: ["okh", "edo"] });
    const b = p({ label: "CHM111", chiefId: "isi", invigilatorIds: ["okh", "osa"] });
    const issues = invigilationIssues([a, b], ctx({ unavailable: [{ lecturerId: "edo", date: "2026-05-15", session: null, reason: "on leave" }] }));
    expect(issues.filter((i) => i.type === "busy").map((i) => i.lecturerId).sort()).toEqual(["okh", "osa"]);
    expect(issues.find((i) => i.type === "unavailable")?.message).toMatch(/Edosomwan is unavailable.*on leave/);
  });

  it("warns about missing chiefs, short-staffed papers and overloaded days", () => {
    const a = p({ invigilatorIds: ["okh"] });
    const b = p({ session: 1, label: "CHM111", chiefId: "okh", invigilatorIds: ["edo", "isi"] });
    const c = p({ session: 2, label: "MTH111", chiefId: "edo", invigilatorIds: ["okh", "isi"] });
    const types = invigilationIssues([a, b, c], ctx()).map((i) => `${i.type}:${i.severity}`);
    expect(types).toContain("noChief:warning");
    expect(types).toContain("short:warning");
    expect(types).toContain("overDay:warning"); // okh: 3 duties that day, limit 2
  });

  it("counts chief and assistant duties separately", () => {
    const c = dutyCounts([p({ chiefId: "osa", invigilatorIds: ["okh"] }), p({ session: 1, chiefId: "okh", invigilatorIds: ["osa", "edo"] })]);
    expect(c.get("okh")).toMatchObject({ chief: 1, assistant: 1, total: 2 });
    expect(c.get("edo")).toMatchObject({ chief: 0, assistant: 1, total: 1 });
  });
});

describe("suggesting assistants", () => {
  const pool = ["egw", "osa", "okh", "edo", "isi", "kon"];

  it("only fills empty places, never touches chiefs or people already assigned", () => {
    const a = p({ chiefId: "osa", invigilatorIds: ["okh"] });
    const s = suggestAssistants([a], pool, ctx());
    expect(s.get(a.id)?.[0]).toBe("okh");
    expect(s.get(a.id)).toHaveLength(2);
    expect(s.get(a.id)).not.toContain("osa");
  });

  it("spreads duties fairly and skips busy or unavailable people", () => {
    const papers = [p({ date: "2026-05-16" }), p({ date: "2026-05-16", label: "CHM111" }), p({ date: "2026-05-16", session: 1, label: "MTH111" })];
    const s = suggestAssistants(papers, pool, ctx({ unavailable: [{ lecturerId: "kon", date: "2026-05-16", session: null }] }));
    const all = [...s.values()].flat();
    expect(all).not.toContain("kon");
    // two papers in the same session never share a person
    const [x, y] = [s.get(papers[0].id)!, s.get(papers[1].id)!];
    expect(x.filter((id) => y.includes(id))).toEqual([]);
    // 6 places for 5 people: nobody gets a second duty before everyone has one
    const counts = new Map<string, number>();
    for (const id of all) counts.set(id, (counts.get(id) ?? 0) + 1);
    expect(Math.max(...counts.values()) - Math.min(...counts.values())).toBeLessThanOrEqual(1);
    expect(counts.size).toBe(5);
  });

  it("puts postgraduate course lecturers on their own papers first", () => {
    const a = p({ label: "CHM111", chiefId: "osa" });
    const s = suggestAssistants([a], pool, ctx({ settings: { assistantsPerPaper: 2, maxPerDay: 2, courseLecturersAssist: true } }));
    expect(s.get(a.id)?.[0]).toBe("egw");
  });

  it("leaves a paper short rather than break a rule", () => {
    const a = p({ chiefId: "osa", assistantsNeeded: 3 });
    const s = suggestAssistants([a], ["osa", "okh"], ctx());
    expect(s.get(a.id)).toEqual(["okh"]);
  });
});

describe("invigilators list", () => {
  const staff = [{ id: "a", dept: "CSC" }, { id: "b", dept: "DTS" }, { id: "c", dept: "CSC" }];
  it("uses the department's staff, everyone for undergraduate, or the saved list", async () => {
    const { resolvePool } = await import("./invigilation");
    expect(resolvePool({ invigilatorPool: null, dept: "CSC" }, staff)).toEqual(["a", "c"]);
    expect(resolvePool({ invigilatorPool: null, dept: null }, staff)).toEqual(["a", "b", "c"]);
    expect(resolvePool({ invigilatorPool: ["b", "gone"], dept: "CSC" }, staff)).toEqual(["b"]);
  });
});

describe("own lecturers on undergraduate papers", () => {
  it("are suggested only when nobody else is free", async () => {
    const { suggestAssistants } = await import("./invigilation");
    const a = p({ label: "CSC111", chiefId: "osa", assistantsNeeded: 1 });
    expect(suggestAssistants([a], ["kon", "okh"], ctx()).get(a.id)).toEqual(["okh"]);
    const b = p({ label: "CSC111", chiefId: "osa", assistantsNeeded: 2 });
    expect(suggestAssistants([b], ["kon", "okh"], ctx()).get(b.id)?.sort()).toEqual(["kon", "okh"]);
  });
});
