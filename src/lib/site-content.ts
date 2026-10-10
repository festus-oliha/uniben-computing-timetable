/**
 * Words and links on the public home page. Edit freely — nothing else depends on this text.
 * The faculty description is a neutral placeholder: replace it with the official wording.
 */

export const SITE = {
  name: "FaCoMS",
  fullName: "Faculty of Computing Management System",
  university: "University of Benin, Benin City",
  universityUrl: "https://www.uniben.edu/",
  faculty: "Faculty of Computing",
  builtBy: "JVeeSoft-IT",
  copyrightYear: 2026,
  tagline: "One place for the Faculty's projects, seminars, timetables, staff and records.",
  /** Placeholder wording — replace with the Faculty's official description. */
  about: [
    "The Faculty of Computing at the University of Benin brings the University's computing and information technology departments together in one faculty. It runs undergraduate (B.Sc.), postgraduate (PGD, M.Sc. and Ph.D.) and part-time programmes.",
    "FaCoMS is the Faculty's own management system. Students and staff use it to find timetables and, as each module is added, to follow projects and seminars, look up staff, and keep results and records.",
  ],
};

export type ModuleStatus = "live" | "building";

export interface ModuleInfo {
  slug: "projects" | "seminars" | "timetable" | "staff" | "records";
  name: string;
  /** One line on the home page. */
  purpose: string;
  /** What the module will hold — shown on its page while it is being built. */
  plans: string[];
  status: ModuleStatus;
  href: string;
  /** Staff-only once built (shown as such on the home page). */
  staffOnly?: boolean;
}

/** The FaCoMS modules, in the order they appear on the home page. Set status to "live" as each is built. */
export const MODULES: ModuleInfo[] = [
  {
    slug: "projects",
    name: "Projects",
    purpose: "Final-year and postgraduate projects, from topic to defence.",
    plans: ["Project topics and approval", "Supervisor allocation by department", "Proposal, chapter and final submissions", "Defence schedules and panels"],
    status: "building",
    href: "/modules/projects",
  },
  {
    slug: "seminars",
    name: "Seminars",
    purpose: "Departmental and postgraduate seminar schedules.",
    plans: ["Seminar calendar by department", "Presenters, topics and venues", "Attendance and assessment", "Year 5 part-time seminar presentations"],
    status: "building",
    href: "/modules/seminars",
  },
  {
    slug: "timetable",
    name: "Timetable",
    purpose: "Lecture, examination and invigilation timetables for every programme.",
    plans: [],
    status: "live",
    href: "/timetables",
  },
  {
    slug: "staff",
    name: "Staff Members",
    purpose: "Who is who in each department, and what they teach.",
    plans: [],
    status: "live",
    href: "/staff",
  },
  {
    slug: "records",
    name: "Results and Records",
    purpose: "Course results, approvals and student records.",
    plans: ["Course result entry by lecturers", "Department and Faculty approval steps", "Student academic records", "Reports for Senate and the Examinations unit"],
    status: "building",
    href: "/modules/records",
    staffOnly: true,
  },
];

/** The Faculty's departments, shown on the home page (codes match course prefixes). */
export const FACULTY_DEPARTMENTS: { code: string; name: string }[] = [
  { code: "CSC", name: "Computer Science" },
  { code: "CYB", name: "Cyber Security" },
  { code: "DTS", name: "Data Science" },
  { code: "ICT", name: "Information & Communication Technology" },
  { code: "IFT", name: "Information Technology" },
  { code: "INS", name: "Information Systems" },
  { code: "SEN", name: "Software Engineering" },
];

export type ScheduleStatus = "live" | "soon";

export interface ScheduleLink {
  label: string;
  hint: string;
  href?: string;
  status: ScheduleStatus;
  staffOnly?: boolean;
}

export interface ProgrammeSection {
  id: string;
  title: string;
  subtitle: string;
  schedules: ScheduleLink[];
}

/** Programme sections and their timetables. Change `status` to "live" and add `href` as each one is built. */
export const PROGRAMMES: ProgrammeSection[] = [
  {
    id: "undergraduate",
    title: "Undergraduate",
    subtitle: "B.Sc. programmes · 100 – 400 Level",
    schedules: [
      { label: "Lecture timetable", hint: "Your weekly lectures by level and department", href: "/view", status: "live" },
      { label: "Examination timetable", hint: "Dates, times and venues of examinations", href: "/view/exams?programme=ug", status: "live" },
    ],
  },
  {
    id: "postgraduate",
    title: "Postgraduate",
    subtitle: "M.Sc. · Ph.D. · PGD",
    schedules: [
      { label: "M.Sc. lecture timetable", hint: "Lectures, usually in the M.Sc. Lab", href: "/view/programme?programme=msc", status: "live" },
      { label: "M.Sc. examination timetable", hint: "M.Sc. examinations", href: "/view/exams?programme=msc", status: "live" },
      { label: "Ph.D. timetable", hint: "Ph.D. seminars and course work", href: "/view/programme?programme=phd", status: "live" },
      { label: "PGD timetable", hint: "Postgraduate Diploma lectures", href: "/view/programme?programme=pgd", status: "live" },
    ],
  },
  {
    id: "part-time",
    title: "Part-time",
    subtitle: "Part-time degree programmes",
    schedules: [
      { label: "Part-time lecture timetable", hint: "Friday and Saturday lectures by year", href: "/view/programme?programme=pt", status: "live" },
      { label: "Part-time examination timetable", hint: "Part-time examinations", href: "/view/exams?programme=pt", status: "live" },
    ],
  },
  {
    id: "invigilation",
    title: "Invigilation",
    subtitle: "For invigilators and examination officers",
    schedules: [{ label: "Invigilation schedule", hint: "Look up your invigilation duties by name", href: "/view/invigilation", status: "live", staffOnly: true }],
  },
];
