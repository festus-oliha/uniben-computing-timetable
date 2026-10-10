"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function StaffNav({ canEdit }: { canEdit: boolean }) {
  const path = usePathname();
  const tabs = [
    { href: "/workspace/staff", label: "Staff list", on: path === "/workspace/staff" || /^\/workspace\/staff\/[0-9a-f-]{36}/.test(path) },
    ...(canEdit
      ? [
          { href: "/workspace/staff/new", label: "Add a person", on: path === "/workspace/staff/new" },
          { href: "/workspace/staff/import", label: "Load a staff list", on: path === "/workspace/staff/import" },
        ]
      : []),
    { href: "/staff", label: "Public directory", on: false },
  ];
  return (
    <nav className="tabs" aria-label="Staff workspace">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className="tab" aria-current={t.on ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
