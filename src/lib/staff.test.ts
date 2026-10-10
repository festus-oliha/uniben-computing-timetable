import { describe, expect, it } from "vitest";
import { categoryOf, deptCode, detectColumns, initials, normaliseRank, parsePasted, rankOrder, rowsToStaff, sameKey } from "./staff";

describe("staff ranks and departments", () => {
  it("tidies common ways of writing ranks", () => {
    expect(normaliseRank("lecturer 1")).toBe("Lecturer I");
    expect(normaliseRank("SL")).toBe("Senior Lecturer");
    expect(normaliseRank("Prof.")).toBe("Professor");
    expect(normaliseRank("Visiting Professor")).toBe("Visiting Professor");
    expect(rankOrder("Professor")).toBeLessThan(rankOrder("Lecturer II"));
  });

  it("works out the category", () => {
    expect(categoryOf("Senior Technologist")).toBe("technical");
    expect(categoryOf("Confidential Secretary")).toBe("administrative");
    expect(categoryOf("Lecturer I")).toBe("academic");
    expect(categoryOf("", "Non-teaching")).toBe("administrative");
  });

  it("recognises departments by code or name", () => {
    expect(deptCode("CSC")).toBe("CSC");
    expect(deptCode("Department of Computer Science")).toBe("CSC");
    expect(deptCode("Information and Communication Technology")).toBe("ICT");
    expect(deptCode("Chemistry")).toBeNull();
  });
});

describe("importing a staff list", () => {
  it("finds the columns from the header row", () => {
    expect(detectColumns(["S/N", "Name of Staff", "Designation", "Department", "E-mail", "GSM No"])).toEqual([null, "name", "rank", "dept", "email", "phone"]);
  });

  it("reads rows pasted from Excel and skips blanks", () => {
    const rows = parsePasted("Name\tRank\tDept\nDr. P. O. Egwali\tlecturer 1\tComputer Science\n\n\tReader\tCSC\nMr. K. Okhuoya\tSenior Technologist\tCSC\n");
    const { staff, skipped } = rowsToStaff(rows.slice(1), ["name", "rank", "dept"]);
    expect(staff.map((s) => [s.name, s.rank, s.dept, s.category])).toEqual([
      ["Dr. P. O. Egwali", "Lecturer I", "CSC", "academic"],
      ["Mr. K. Okhuoya", "Senior Technologist", "CSC", "technical"],
    ]);
    expect(skipped).toEqual([{ row: 2, reason: "no name" }]);
  });

  it("matches the same person written differently", () => {
    expect(sameKey("Prof. (Mrs.) S. Konyeha")).toBe(sameKey("Konyeha S."));
    expect(sameKey("Dr. P. O. Egwali")).toBe(sameKey("EGWALI, P.O."));
    expect(sameKey("Dr. A. Osaseri")).not.toBe(sameKey("Dr. R. O. Osaseri"));
    expect(initials("Prof. (Mrs.) S. Konyeha")).toBe("SK");
  });
});
