/**
 * Fixed wording printed on the official timetable (page 2).
 * Edit here when the notes, distribution list or signatory change.
 */
export const DOCUMENT_TEXT = {
  university: "UNIVERSITY OF BENIN, BENIN CITY, NIGERIA",
  faculty: "FACULTY OF COMPUTING",
  title: "Faculty Lecture Time-Table",

  ptNote: "denotes part-time lecture periods.",

  notes: [
    "Details of grouping of 100 level students into Physics, Chemistry, PBB and AEB practical can be obtained from the respective department.",
    "We appeal to all departments to please cooperate with other departments in the use of their lecture halls, laboratories, etc. as indicated on the Faculty Lecture Timetable.",
    "CED 300 should be registered by all 300 level students.",
    "All matters pertaining to the time-table should be referred to undersigned through the respective departmental timetable officer for necessary action. However, we may not be able to resolve all clash cases arising from students’ carry-over courses.",
  ],

  distributionTo: "All Heads of Department, Faculty of Computing",
  ccLeft: [
    "The Vice-Chancellor",
    "Deans",
    "The Deans of Computing, Life & Physical Sciences",
    "Asst. Deans of Computing, Life & Physical Sciences",
    "Examination Officers, Faculty of Computing, Life & Physical Sciences",
    "D.R. (Academics)",
    "Dean of Students",
    "Deans of Education, Social Sciences, Engineering, Agriculture, Medicine, Pharmacy, Dentistry",
  ],
  ccRight: [
    "Departmental Time-Table Officers, Faculty of Computing",
    "D.V.C (Academic)",
    "Director, Academic Planning",
    "Director GST",
    "P.A.R., Faculty of Computing, Faculty of Life & Physical Sciences",
    "D.R. (Exams & Records)",
    "CED 300 Coordinator",
    "Notice Boards (Faculty of Computing, Physical Sciences, & Life Sciences)",
  ],

  signatory: {
    name: "F. O. Oliha, PhD.",
    role: "Faculty of Computing Time-Table Officer",
    forWhom: "For: Dean, Faculty of Computing.",
  },
} as const;

/** Fixed wording on examination timetables (from the Faculty's current examination timetable). */
export const EXAM_TEXT = {
  closing: "The Dean wishes you success in your examinations.",
  /** Distribution for the Faculty-wide (undergraduate) examination timetable. */
  cc: [
    "The Vice-Chancellor",
    "The Dean of Computing",
    "The Dean of Physical Sciences",
    "Dean of Life Sciences",
    "Dean of Optometry",
    "All Heads of Departments, Faculty of Computing",
    "Dean's Notice Boards (Faculty of Computing)",
    "Asst. Dean of Computing",
    "Examination Officer, Faculty of Computing; Physical Sciences",
    "Director CRPU",
    "Director GST",
    "Faculty Officer, Computing",
    "D.R. (Academics)",
    "D.R. (Admin.)",
    "Director, Academic Planning",
    "Head, UNIBEN Security Zone G",
    "Chief Security Officer (CSO)",
  ],
  /** Distribution for a department's part-time / postgraduate examination timetable. */
  deptCc: ["The Dean, Faculty of Computing", "Head of Department", "Examination Officer, Faculty of Computing", "Faculty Time-Table Officer", "Departmental Notice Board"],
} as const;
