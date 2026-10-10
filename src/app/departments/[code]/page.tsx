import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listStaffRows, toPublicStaff } from "@/lib/staff-data";
import { listProgrammeTimetables } from "@/lib/programme-data";
import { getPublishedExamTimetables } from "@/lib/exam-data";
import { DEPARTMENT_FEATURES, FACULTY_DEPARTMENTS } from "@/lib/site-content";
import { CATEGORIES, initials, type StaffCategory } from "@/lib/staff";
import { PROGRAMMES, isProgramme } from "@/lib/programmes";
import { ModuleIcon } from "@/components/brand/ModuleIcon";
import { ModuleHeader, SiteFooter } from "@/components/brand/SiteChrome";
import "../departments.css";

const find = (code: string) => FACULTY_DEPARTMENTS.find((d) => d.code.toLowerCase() === code.toLowerCase());

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const d = find((await params).code);
  return { title: d ? `Department of ${d.name} — FaCoMS` : "Departments — FaCoMS" };
}

/** One department: head, staff, timetables, and the parts still being built (projects, seminars, records). */
export default async function DepartmentPage({ params }: { params: Promise<{ code: string }> }) {
  const d = find((await params).code);
  if (!d) notFound();
  const [me, staff, programmes, exams] = await Promise.all([getCurrentUser(), listStaffRows(), listProgrammeTimetables(), getPublishedExamTimetables()]);
  const mine = staff.filter((s) => s.isActive && s.dept === d.code).map(toPublicStaff);
  const head = mine.find((s) => /head of (the )?department|^hod$/i.test(s.position));
  const byCat = (Object.keys(CATEGORIES) as StaffCategory[]).map((c) => ({ c, n: mine.filter((s) => s.category === c).length })).filter((x) => x.n);
  const current = programmes.filter((t) => t.dept === d.code && t.isPublished);
  const latestSem = Math.max(0, ...current.map((t) => t.semesterId));
  const progs = current.filter((t) => t.semesterId === latestSem);
  const deptExams = exams.filter((t) => t.dept === d.code);

  return (
    <div className="dp">
      <ModuleHeader module="Departments" signedIn={!!me} />
      <main className="dd">
        <p className="dd-back">
          <Link href="/departments">All departments</Link>
        </p>
        <header className="dd-head">
          <span className="dd-code">{d.code}</span>
          <h1>Department of {d.name}</h1>
          {head && (
            <Link href={`/staff/${head.id}`} className="dd-hod">
              {head.photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={head.photoUrl} alt="" />
              ) : (
                <span className="ini">{initials(head.name)}</span>
              )}
              <span>
                <b>{head.name}</b>
                <small>Head of Department</small>
              </span>
            </Link>
          )}
        </header>

        <div className="dd-cols">
          <section className="dd-block">
            <h2>Staff</h2>
            {mine.length ? (
              <>
                <p>
                  {byCat.map((x, i) => (
                    <span key={x.c}>
                      {i ? ", " : ""}
                      {x.n} {CATEGORIES[x.c].label.toLowerCase()}
                    </span>
                  ))}
                  .
                </p>
                <ul className="dd-faces">
                  {mine.slice(0, 12).map((s) => (
                    <li key={s.id}>
                      <Link href={`/staff/${s.id}`} title={`${s.name}${s.rank ? `, ${s.rank}` : ""}`}>
                        {s.photoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={s.photoUrl} alt={s.name} loading="lazy" />
                        ) : (
                          <span className="ini">{initials(s.name)}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link className="dd-more" href={`/staff?dept=${d.code}`}>
                  See all {mine.length} staff
                </Link>
              </>
            ) : (
              <p className="dd-quiet">The staff list for this department is being prepared.</p>
            )}
          </section>

          <section className="dd-block">
            <h2>Timetables</h2>
            <ul className="dd-links">
              <li>
                <Link href={`/view?by=class&dept=${d.code}`}>Undergraduate lecture timetable</Link>
              </li>
              <li>
                <Link href="/view/exams?programme=ug">Undergraduate examination timetable</Link>
              </li>
              {progs.map((t) => (
                <li key={t.id}>
                  <Link href={`/view/programme?t=${t.id}`}>{isProgramme(t.programme) ? PROGRAMMES[t.programme].label : t.programme} lecture timetable</Link>
                </li>
              ))}
              {deptExams.map((t) => (
                <li key={t.id}>
                  <Link href={`/view/exams?t=${t.id}`}>{isProgramme(t.programme) ? PROGRAMMES[t.programme].label : t.programme} examination timetable</Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="dd-soon" aria-labelledby="soon-h">
          <h2 id="soon-h">Coming to this page</h2>
          <ul>
            {DEPARTMENT_FEATURES.map((f) => (
              <li key={f.name}>
                <span className="dd-ico">
                  <ModuleIcon slug={f.icon} size={24} />
                </span>
                <span>
                  <b>{f.name}</b>
                  {f.staffOnly && <em>Staff only</em>}
                  <small>{f.purpose}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
