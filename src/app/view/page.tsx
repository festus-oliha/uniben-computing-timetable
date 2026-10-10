import Link from "next/link";
import { getPublishedSemesters, getTimetableData } from "@/lib/data";
import { publicEntries, timeRange, type PublicFilter } from "@/lib/public-view";
import { DEPARTMENTS, FACULTY_DEPTS, levelName } from "@/lib/timetable";
import { PrintButton } from "@/components/PrintButton";
import "./view.css";

export const metadata = {
  title: "Lecture Timetable — Faculty of Computing, UNIBEN",
  description: "Find your lecture timetable by level and department, lecturer or venue.",
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
type Params = { sem?: string; by?: string; level?: string; dept?: string; lecturer?: string; venue?: string };

/** Public, no sign-in: students and lecturers look up their week. Only published semesters appear. */
export default async function PublicView({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const published = await getPublishedSemesters();
  const sem = published.find((s) => String(s.id) === p.sem) ?? published[0];

  if (!sem) {
    return (
      <Shell>
        <section className="pv-card pv-empty">
          <h2>The timetable hasn&apos;t been published yet</h2>
          <p>Check back soon, or ask your departmental time-table officer.</p>
        </section>
      </Shell>
    );
  }

  const data = await getTimetableData(sem.id);
  const by = p.by === "lecturer" || p.by === "venue" ? p.by : "class";
  const level = Number(p.level) || 0;
  const dept = FACULTY_DEPTS.includes(p.dept as never) ? (p.dept as string) : "";

  let filter: PublicFilter | null = null;
  let heading = "";
  if (by === "class" && level && dept) {
    filter = { kind: "class", level, dept };
    heading = `${levelName(level)} · ${DEPARTMENTS[dept]}`;
  } else if (by === "lecturer" && p.lecturer) {
    const l = data.lecturers.find((x) => x.id === p.lecturer);
    if (l) {
      filter = { kind: "lecturer", lecturerId: l.id };
      heading = l.name;
    }
  } else if (by === "venue" && p.venue) {
    const v = data.venues.find((x) => x.code === p.venue);
    if (v) {
      filter = { kind: "venue", venue: v.code };
      heading = `Venue ${v.code} · ${v.name}`;
    }
  }
  const entries = filter ? publicEntries(filter, data) : [];
  const semLabel = `${sem.session} ${sem.name}`;
  const tab = (key: string, label: string) => (
    <Link className={`pv-tab${by === key ? " on" : ""}`} href={`/view?${new URLSearchParams({ ...(p.sem ? { sem: p.sem } : {}), by: key })}`}>
      {label}
    </Link>
  );

  return (
    <Shell semester={semLabel}>
      <section className="pv-card pv-find">
        <nav className="pv-tabs" aria-label="Find a timetable by">
          {tab("class", "My class")}
          {tab("lecturer", "Lecturer")}
          {tab("venue", "Venue")}
        </nav>
        <form method="get" className="pv-form">
          <input type="hidden" name="by" value={by} />
          {published.length > 1 && (
            <label>
              <span>Semester</span>
              <select name="sem" defaultValue={String(sem.id)}>
                {published.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.session} {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {by === "class" && (
            <>
              <label>
                <span>Level</span>
                <select name="level" defaultValue={level ? String(level) : ""} required>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}00 Level
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Department</span>
                <select name="dept" defaultValue={dept} required>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {FACULTY_DEPTS.map((d) => (
                    <option key={d} value={d}>
                      {DEPARTMENTS[d]}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {by === "lecturer" && (
            <label className="wide">
              <span>Lecturer</span>
              <select name="lecturer" defaultValue={p.lecturer ?? ""} required>
                <option value="" disabled>
                  {data.lecturers.length ? "Choose…" : "No lecturers listed yet"}
                </option>
                {data.lecturers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {by === "venue" && (
            <label className="wide">
              <span>Venue</span>
              <select name="venue" defaultValue={p.venue ?? ""} required>
                <option value="" disabled>
                  Choose…
                </option>
                {data.venues.map((v) => (
                  <option key={v.code} value={v.code}>
                    {v.code} — {v.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="pv-go" type="submit">
            Show timetable
          </button>
        </form>
      </section>

      {filter && (
        <section className="pv-card pv-week">
          <header className="pv-week-head">
            <div>
              <h2>{heading}</h2>
              <p>
                {semLabel} · {entries.length} {entries.length === 1 ? "class" : "classes"} a week
              </p>
            </div>
            <div className="pv-noprint">
              <PrintButton />
            </div>
          </header>
          {entries.length === 0 ? (
            <p className="pv-none">No lectures found for this selection.</p>
          ) : (
            DAY_NAMES.map((dayName, d) => {
              const today = entries.filter((e) => e.day === d);
              return (
                <div key={dayName} className="pv-day">
                  <h3>{dayName}</h3>
                  {today.length === 0 ? (
                    <p className="pv-free">No lectures</p>
                  ) : (
                    <ul>
                      {today.map((e) => (
                        <li key={e.id} className={e.activity ? "act" : e.isCommon ? "common" : ""}>
                          <span className="t">{timeRange(e.start, e.span)}</span>
                          <span className="c">
                            <b>{e.label.split("/").join(" / ")}</b>
                            {e.isCommon && <em>Common course</em>}
                          </span>
                          <span className="v">
                            {e.venue ? (
                              <>
                                <b>{e.venue.code}</b> {e.venue.name}
                              </>
                            ) : null}
                          </span>
                          {e.lecturers.length > 0 && <span className="l">{e.lecturers.join(", ")}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
          <p className="pv-note">
            Times may change. Clashes or problems? Contact your departmental time-table officer. Bookmark this page to come back
            to your timetable.
          </p>
        </section>
      )}
    </Shell>
  );
}

function Shell({ children, semester }: { children: React.ReactNode; semester?: string }) {
  return (
    <div className="pv">
      <header className="pv-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/crest.png" alt="University of Benin crest" />
        <a href="/" className="pv-home" title="Faculty home page">
          <small>University of Benin</small>
          <h1>Faculty of Computing</h1>
          <p>Lecture Timetable{semester ? ` · ${semester}` : ""}</p>
        </a>
      </header>
      <main className="pv-main">{children}</main>
      <footer className="pv-foot">
        <Link href="/">Faculty of Computing</Link> · University of Benin, Benin City
        <span className="pv-noprint">
          {" "}
          · <Link href="/login">Staff sign in</Link>
        </span>
      </footer>
    </div>
  );
}
