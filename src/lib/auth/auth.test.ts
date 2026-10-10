import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, temporaryPassword, verifyPassword } from "./password";
import { canEditBooking, canEditCourse, canManageLecturer, canSignOff, canEditTimetable, type Actor } from "../permissions";

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
