import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { listStaffRows, toPublicStaff } from "@/lib/staff-data";
import { CATEGORIES, initials, type StaffCategory } from "@/lib/staff";
import { FACULTY_DEPARTMENTS } from "@/lib/site-content";
import { ModuleHeader, SiteFooter } from "@/components/brand/SiteChrome";
import "./staff.css";

export const metadata = {
  title: "Staff Members — FaCoMS, University of Benin",
  description: "Academic, technical and administrative staff of the Faculty of Computing, University of Benin.",
};

type Params = { dept?: string; cat?: string; q?: string };

/** Public staff directory: no contact details. */
export default async function StaffDirectory({ searchParams }: { searchParams: Promise<Params> }) {
  const [p, me, rows] = await Promise.all([searchParams, getCurrentUser(), listStaffRows()]);
  const dept = FACULTY_DEPARTMENTS.some((d) => d.code === p.dept) ? p.dept! : "";
  const cat = p.cat && p.cat in CATEGORIES ? (p.cat as StaffCategory) : "";
  const words = (p.q ?? "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  const staff = rows
    .filter((l) => l.isActive)
    .map(toPublicStaff)
    .filter((s) => (!dept || s.dept === dept) && (!cat || s.category === cat) && words.every((w) => `${s.name} ${s.rank} ${s.position} ${s.interests}`.toLowerCase().includes(w)));
  const groups = [...FACULTY_DEPARTMENTS.map((d) => ({ code: d.code, name: `Department of ${d.name}` })), { code: "", name: "Faculty office" }]
    .map((g) => ({ ...g, people: staff.filter((s) => (s.dept ?? "") === g.code) }))
    .filter((g) => g.people.length);
  const link = (o: Partial<Params>) => {
    const q = new URLSearchParams(Object.entries({ dept, cat, q: p.q ?? "", ...o }).filter(([, v]) => v) as [string, string][]);
    return `/staff${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="sd">
      <ModuleHeader module="Staff Members" signedIn={!!me} />
      <section className="sd-lead">
        <div>
          <h1>Staff Members</h1>
          <p>The academic, technical and administrative staff of the Faculty of Computing.</p>
        </div>
        {me && (
          <Link className="tt-btn" href="/workspace/staff">
            Open the staff workspace
          </Link>
        )}
      </section>
      <div className="sd-filters">
        <nav aria-label="Departments">
          <Link href={link({ dept: "" })} aria-current={!dept ? "page" : undefined}>
            All departments
          </Link>
          {FACULTY_DEPARTMENTS.map((d) => (
            <Link key={d.code} href={link({ dept: d.code })} aria-current={dept === d.code ? "page" : undefined}>
              {d.name}
            </Link>
          ))}
        </nav>
        <form method="get" className="sd-search">
          {dept && <input type="hidden" name="dept" value={dept} />}
          <select name="cat" defaultValue={cat} aria-label="Category">
            <option value="">All staff</option>
            {(Object.keys(CATEGORIES) as StaffCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c].plural}
              </option>
            ))}
          </select>
          <input name="q" defaultValue={p.q ?? ""} placeholder="Search by name or research area" aria-label="Search" />
          <button type="submit">Search</button>
        </form>
      </div>

      <main className="sd-main">
        {groups.length === 0 ? (
          <p className="sd-none">{rows.length ? "Nobody matches that search." : "The staff directory is being prepared."}</p>
        ) : (
          groups.map((g) => (
            <section key={g.code || "office"} className="sd-group">
              <h2>{g.name}</h2>
              <ul className="sd-grid">
                {g.people.map((s) => (
                  <li key={s.id}>
                    <Link href={`/staff/${s.id}`} className="sd-card">
                      {s.photoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={s.photoUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="sd-ini">{initials(s.name)}</span>
                      )}
                      <span className="sd-name">{s.name}</span>
                      <span className="sd-rank">{s.rank || CATEGORIES[s.category as StaffCategory]?.label}</span>
                      {s.position && <span className="sd-pos">{s.position}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
