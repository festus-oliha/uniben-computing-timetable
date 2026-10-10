import type { ModuleInfo } from "@/lib/site-content";

/** Line icons for the FaCoMS modules (24 × 24, drawn in the current text colour). */
export function ModuleIcon({ slug, size = 28 }: { slug: ModuleInfo["slug"]; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (slug) {
    case "projects": // a bound project report with a bookmark
      return (
        <svg {...common}>
          <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
          <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H18v-3" />
          <path d="M9 7h5M9 10h5" />
          <path d="M14.5 3v6l1.5-1.2L17.5 9V3" />
        </svg>
      );
    case "seminars": // a lectern with a screen behind it
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="10" rx="1.5" />
          <path d="M7 9.5l2.5-2.5 2 2 3.5-3.5" />
          <path d="M9 21h6M10 21l.6-5h2.8l.6 5M9 16h6" />
        </svg>
      );
    case "timetable": // a week grid with one booked block
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="18" height="16" rx="2" />
          <path d="M3 9.5h18M9 9.5v11M15 9.5v11M3 15h18M8 3v3M16 3v3" />
          <path d="M10.2 10.7h3.6v3.1h-3.6z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "staff": // two people
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20c.4-3.4 2.7-5.5 5.5-5.5s5.1 2.1 5.5 5.5" />
          <circle cx="16.8" cy="9.2" r="2.5" />
          <path d="M15.5 14.6c2.6-.2 4.6 1.6 5 4.4" />
        </svg>
      );
    case "records": // a result sheet with a tick
      return (
        <svg {...common}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <path d="M8.5 12h7M8.5 15.5h3" />
          <path d="M13.5 17l1.6 1.6 3-3.2" />
        </svg>
      );
  }
}
