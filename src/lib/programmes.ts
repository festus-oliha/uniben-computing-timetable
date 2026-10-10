/** Programmes the Faculty runs timetables for. Pure data — safe on server and browser. */

export type Programme = "ug" | "pt" | "msc" | "phd" | "pgd";

export const PROGRAMMES: Record<Programme, { label: string; short: string; deptScoped: boolean }> = {
  ug: { label: "Undergraduate (full-time)", short: "Undergraduate", deptScoped: false },
  pt: { label: "Part-time", short: "Part-time", deptScoped: true },
  msc: { label: "M.Sc.", short: "M.Sc.", deptScoped: true },
  phd: { label: "Ph.D.", short: "Ph.D.", deptScoped: true },
  pgd: { label: "PGD", short: "PGD", deptScoped: true },
};

export const PROGRAMME_ORDER: Programme[] = ["ug", "pt", "msc", "phd", "pgd"];

export const isProgramme = (p: string): p is Programme => p in PROGRAMMES;

/** Session columns each programme's examination timetable starts with (editable per timetable). */
export function defaultExamSessions(p: Programme) {
  if (p === "ug" || p === "pt")
    return [
      { name: "Morning Session", time: "8.00A.M. – 11.00A.M." },
      { name: "Afternoon Session", time: "11.30A.M. – 2.30P.M." },
      { name: "Evening Session", time: "3.00P.M. – 6.00P.M." },
    ];
  return [{ name: "Examination", time: "9.00am – 12.00 noon" }];
}

/** Weekdays examinations normally run on (0 = Sunday … 6 = Saturday). */
export function defaultExamWeekdays(p: Programme): number[] {
  if (p === "pt") return [5, 6]; // Friday, Saturday
  if (p === "ug") return [1, 2, 3, 4, 5, 6];
  return [1, 2, 3, 4, 5];
}

/** Notes printed under a new examination timetable (from the Faculty's current timetables; editable per timetable). */
export function defaultExamNotes(p: Programme): string[] {
  if (p === "ug" || p === "pt")
    return [
      "Only students who have paid the prescribed school charges and possess valid student identity cards are eligible to sit for examinations.",
      "Information on the grouping for computer-based examinations should be provided by the respective departments in consultation with the CRPU/ICTU.",
      "Report any anomalies such as clashes from students with carry-over courses to the respective departmental time-table officer for possible internal arrangement without necessarily moving the papers and venues.",
      "For large courses, students of other faculties outside Physical Sciences may take the examinations in their respective faculties in co-operation with the appropriate department in-charge of the course(s).",
      "Practical examinations shall hold in laboratories as arranged by the respective departments.",
      "No GSM phone or any other communication device(s) is allowed into the examination venue.",
      "Read the relevant portion of the prospectus on the regulations governing the conduct of university examinations.",
      "Do not indulge in any form of examination malpractice/misconduct. The minimum punishment for an offender is expulsion from the university.",
      "When alleged of any form of examination malpractice/misconduct, please complete and sign the malpractice/misconduct form. Failure to do so would attract additional punishment.",
      "Your language should be civil and polite to invigilators/attendants.",
      "Please, in your own interest, be warned: stay clear of any form of irregularities. Revise your student handbook to know the forms of malpractices and penalties.",
    ];
  return [
    "Course lecturers are also required to invigilate their examination so that they can collect scripts for marking. Scripts and results should be returned two (02) weeks after the date of the written course examination.",
  ];
}
