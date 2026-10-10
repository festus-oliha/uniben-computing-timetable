import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, temporaryPassword, verifyPassword } from "./password";
import { canAddExamPapers, canEditBooking, canEditCourse, canEditExamPaper, canManageExamTimetable, canManageLecturer, canSignOff, canEditTimetable, type Actor } from "../permissions";

describe("passwords", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const h = await hashPassword("timetable2026");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("timetable2026", h)).toBe(true);
    expect(await verifyPassword("timetable2027", h)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same-password-1")).not.toBe(await hashPassword("same-password-1"));
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });

  it("enforces simple strength rules", () => {
    expect(passwordProblem("short1")).toMatch(/10 characters/);
    expect(passwordProblem("onlyletterslong")).toMatch(/letters and numbers/);
    expect(passwordProblem("uniben-timetable-1")).toBeNull();
  });

  it("generates temporary passwords that meet the rules", () => {
    for (let i = 0; i < 20; i++) expect(passwordProblem(temporaryPassword())).toBeNull();
  });
});

describe("permissions", () => {
  const admin: Actor = { role: "admin", dept: null };
  const csc: Actor = { role: "dept_officer", dept: "CSC" };
  const viewer: Actor = { role: "viewer", dept: null };

  it("lets the Faculty Officer edit everything", () => {
    expect(canEditBooking(admin, { kind: "shared", label: "CHM201" })).toBe(true);
    expect(canSignOff(admin)).toBe(true);
  });

  it("limits a department officer to their own course lectures", () => {
    expect(canEditBooking(csc, { kind: "course", label: "CSC308/CSC411" })).toBe(true);
    expect(canEditBooking(csc, { kind: "course", label: "DTS304" })).toBe(false);
    expect(canEditBooking(csc, { kind: "course", label: "CSC301/DTS301" })).toBe(false);
    expect(canEditBooking(csc, { kind: "course", label: "COS101" })).toBe(false);
    expect(canEditBooking(csc, { kind: "activity", label: "Mathematics Tutorial" })).toBe(false);
    expect(canEditBooking(csc, { kind: "shared", label: "CSC999" })).toBe(false);
    expect(canSignOff(csc)).toBe(false);
  });

  it("uses the course's recorded department when it differs from the code", () => {
    const deptOf = (c: string) => (c === "INS401" ? "CSC" : c.slice(0, 3));
    expect(canEditBooking(csc, { kind: "course", label: "INS401" }, deptOf)).toBe(true);
  });

  it("limits courses and lecturers to the officer's department", () => {
    expect(canEditCourse(csc, { code: "CSC424", dept: "CSC" })).toBe(true);
    expect(canEditCourse(csc, { code: "IFT442", dept: "IFT" })).toBe(false);
    expect(canManageLecturer(csc, { dept: "CSC" })).toBe(true);
    expect(canManageLecturer(csc, { dept: "DTS" })).toBe(false);
  });

  it("gives viewers no editing at all", () => {
    expect(canEditTimetable(viewer)).toBe(false);
    expect(canEditBooking(viewer, { kind: "course", label: "CSC301" })).toBe(false);
    expect(canEditCourse(viewer, { code: "CSC301", dept: "CSC" })).toBe(false);
    expect(canEditTimetable(null)).toBe(false);
  });
});

describe("exam permissions", () => {
  const admin: Actor = { role: "admin", dept: null };
  const csc: Actor = { role: "dept_officer", dept: "CSC" };
  const viewer: Actor = { role: "viewer", dept: null };
  const ug = { dept: null };
  const cscPT = { dept: "CSC" };
  const dtsPT = { dept: "DTS" };

  it("lets a department officer run their own department's exam timetables", () => {
    expect(canManageExamTimetable(csc, cscPT)).toBe(true);
    expect(canManageExamTimetable(csc, dtsPT)).toBe(false);
    expect(canManageExamTimetable(csc, ug)).toBe(false);
    expect(canEditExamPaper(csc, cscPT, { kind: "paper", label: "MTH101" })).toBe(true);
  });

  it("limits a department officer to their own papers on the Faculty timetable", () => {
    expect(canEditExamPaper(csc, ug, { kind: "paper", label: "CSC311" })).toBe(true);
    expect(canEditExamPaper(csc, ug, { kind: "paper", label: "DTS201" })).toBe(false);
    expect(canEditExamPaper(csc, ug, { kind: "block", label: "GST" })).toBe(false);
    expect(canAddExamPapers(csc, ug)).toBe(true);
  });

  it("gives the Faculty Officer everything and viewers nothing", () => {
    expect(canManageExamTimetable(admin, dtsPT)).toBe(true);
    expect(canEditExamPaper(viewer, ug, { kind: "paper", label: "CSC311" })).toBe(false);
    expect(canAddExamPapers(viewer, cscPT)).toBe(false);
  });
});

describe("programme timetable permissions", () => {
  it("lets only the Faculty Officer and the department's own officer change a department's timetable", async () => {
    const { canManageProgrammeTimetable } = await import("../permissions");
    expect(canManageProgrammeTimetable({ role: "admin", dept: null }, { dept: "DTS" })).toBe(true);
    expect(canManageProgrammeTimetable({ role: "dept_officer", dept: "CSC" }, { dept: "CSC" })).toBe(true);
    expect(canManageProgrammeTimetable({ role: "dept_officer", dept: "CSC" }, { dept: "DTS" })).toBe(false);
    expect(canManageProgrammeTimetable({ role: "viewer", dept: null }, { dept: "CSC" })).toBe(false);
  });
});
