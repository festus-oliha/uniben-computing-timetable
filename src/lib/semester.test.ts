import { describe, expect, it } from "vitest";
import { nextSemester, sessionProblem, shouldCopy } from "./semester";

describe("semesters", () => {
  it("suggests the semester that comes next", () => {
    expect(nextSemester("2026/2027", "First Semester")).toEqual({ session: "2026/2027", name: "Second Semester" });
    expect(nextSemester("2026/2027", "Second Semester")).toEqual({ session: "2027/2028", name: "First Semester" });
  });

  it("checks the session format", () => {
    expect(sessionProblem("2026/2027")).toBeNull();
    expect(sessionProblem("2026-2027")).toMatch(/like 2026\/2027/);
    expect(sessionProblem("2026/2028")).toMatch(/follow/);
  });

  it("copies the right bookings for each option", () => {
    expect(shouldCopy("all", "course")).toBe(true);
    expect(shouldCopy("fixed", "course")).toBe(false);
    expect(shouldCopy("fixed", "shared")).toBe(true);
    expect(shouldCopy("fixed", "pt")).toBe(true);
    expect(shouldCopy("none", "shared")).toBe(false);
  });
});
