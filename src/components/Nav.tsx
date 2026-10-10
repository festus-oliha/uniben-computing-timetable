"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Timetable" },
  { href: "/courses", label: "Courses" },
  { href: "/lecturers", label: "Lecturers" },
  { href: "/clashes", label: "Clashes" },
  { href: "/sign", label: "Sign-off" },
];

export function Nav({ clashCount }: { clashCount: number }) {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Sections">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className="tab" aria-current={path === t.href ? "page" : undefined}>
          {t.label}
          {t.href === "/clashes" && <span className={`count${clashCount === 0 ? " zero" : ""}`}>{clashCount}</span>}
        </Link>
      ))}
    </nav>
  );
}
