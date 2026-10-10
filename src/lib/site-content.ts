/**
 * Words and links on the public home page. Edit freely — nothing else depends on this text.
 * The faculty description is a neutral placeholder: replace it with the official wording.
 */

export const SITE = {
  university: "University of Benin, Benin City",
  faculty: "Faculty of Computing",
  tagline: "Lecture, examination and invigilation timetables for every programme in the Faculty.",
  about: [
    "The Faculty of Computing brings together the University of Benin's departments in computing and information technology, offering undergraduate, postgraduate and part-time programmes.",
    "This site publishes the Faculty's official lecture timetables, examination timetables and invigilation schedules. Pick your programme below to find yours.",
  ],
};

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
