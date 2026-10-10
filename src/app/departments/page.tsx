import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { listStaffRows } from "@/lib/staff-data";
import { FACULTY_DEPARTMENTS } from "@/lib/site-content";
import { ModuleHeader, SiteFooter } from "@/components/brand/SiteChrome";
import "./departments.css";

export const metadata = {
  title: "Departments — FaCoMS, University of Benin",
  description: "The departments of the Faculty of Computing, University of Benin.",
};

export default async function DepartmentsPage() {
  const [me, staff] = await Promise.all([getCurrentUser(), listStaffRows()]);
  const active = staff.filter((s) => s.isActive);
  return (
    <div className="dp">
      <ModuleHeader module="Departments" signedIn={!!me} />
      <section className="dp-lead">
        <h1>Departments</h1>
        <p>The Faculty of Computing has {FACULTY_DEPARTMENTS.length} departments. Each page shows the department&apos;s staff and timetables; projects, seminars and records are being added.</p>
      </section>
      <main className="dp-main">
        <ul className="dp-list">
          {FACULTY_DEPARTMENTS.map((d) => {
            const mine = active.filter((s) => s.dept === d.code);
            const head = mine.find((s) => /head of (the )?department|^hod$/i.test(s.position));
            return (
              <li key={d.code}>
                <Link href={`/departments/${d.code.toLowerCase()}`}>
                  <span className="dp-code">{d.code}</span>
                  <span className="dp-name">{d.name}</span>
                  <span className="dp-meta">
                    {head ? `Head: ${head.name}` : ""}
                    {head && mine.length ? ". " : ""}
                    {mine.length ? `${mine.length} staff listed` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
