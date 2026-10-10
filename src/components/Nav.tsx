"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/timetable", label: "Timetable" },
  { href: "/courses", label: "Courses" },
  { href: "/lecturers", label: "Lecturers" },
  { href: "/clashes", label: "Clashes" },
  { href: "/programmes", label: "Part-time & PG" },
  { href: "/exams", label: "Exams" },
  { href: "/sign", label: "Sign-off" },
  { href: "/history", label: "History" },
  { href: "/users", label: "Users", adminOnly: true },
  { href: "/settings", label: "Settings", adminOnly: true },
];

export function Nav({ clashCount, isAdmin }: { clashCount: number; isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Sections">
      {TABS.filter((t) => !("adminOnly" in t) || isAdmin).map((t) => (
        <Link key={t.href} href={t.href} className="tab" aria-current={path === t.href || (t.href !== "/timetable" && path.startsWith(`${t.href}/`)) ? "page" : undefined}>
          {t.label}
          {t.href === "/clashes" && <span className={`count${clashCount === 0 ? " zero" : ""}`}>{clashCount}</span>}
        </Link>
      ))}
    </nav>
  );
}
