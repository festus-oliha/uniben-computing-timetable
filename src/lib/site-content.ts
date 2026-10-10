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
  tagline: "One place for the Faculty's departments, news, timetables, staff and prospectus.",
  /** Placeholder wording — replace with the Faculty's official description. */
  about: [
    "The Faculty of Computing at the University of Benin brings the University's computing and information technology departments together in one faculty. It runs undergraduate (B.Sc.), postgraduate (PGD, M.Sc. and Ph.D.) and part-time programmes.",
    "FaCoMS is the Faculty's own management system. Students and staff use it to find timetables, look up staff and departments and, as each part is added, to follow Faculty news, read the prospectus, and manage each department's projects, seminars and records.",
  ],
};

export type ModuleStatus = "live" | "building";

/** Icons available for modules and department features (see src/components/brand/ModuleIcon.tsx). */
export type IconName = "departments" | "news" | "timetable" | "staff" | "prospectus" | "projects" | "seminars" | "records";

export interface ModuleInfo {
  slug: "departments" | "news" | "timetable" | "staff" | "prospectus";
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
    slug: "departments",
    name: "Departments",
    purpose: "Each department's page: its staff, programmes, projects, seminars and records.",
    plans: [],
    status: "live",
    href: "/departments",
  },
  {
    slug: "news",
    name: "Faculty News",
    purpose: "Announcements, events and achievements across the Faculty.",
    plans: ["News and announcements from the Dean's office", "Events, conferences and workshops", "Staff and student achievements", "Notices for students, by department and level"],
    status: "building",
    href: "/modules/news",
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
    slug: "prospectus",
    name: "Prospectus",
    purpose: "Programmes, admission requirements and course outlines.",
    plans: ["Programmes offered by each department", "Admission and entry requirements", "Course outlines by level and semester", "Graduation requirements and regulations", "Download the prospectus as a PDF"],
    status: "building",
    href: "/modules/prospectus",
  },
];

/** Parts of each department's page that are still being built (shown on the department pages). */
export const DEPARTMENT_FEATURES: { icon: IconName; name: string; purpose: string; staffOnly?: boolean }[] = [
  { icon: "projects", name: "Projects", purpose: "Final-year and postgraduate project topics, supervisors, submissions and defences." },
  { icon: "seminars", name: "Seminars", purpose: "The department's seminar calendar: presenters, topics, venues and assessment." },
  { icon: "records", name: "Results and Records", purpose: "Course results, approvals and student records.", staffOnly: true },
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
