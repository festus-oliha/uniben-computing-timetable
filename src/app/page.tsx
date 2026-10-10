import Link from "next/link";
import { getPublishedSemesters } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth/session";
import { FACULTY_DEPARTMENTS, PROGRAMMES, SITE } from "@/lib/site-content";
import "./home.css";

export const metadata = {
  title: "Faculty of Computing Timetables — University of Benin",
  description: "Lecture, examination and invigilation timetables for the Faculty of Computing, University of Benin.",
};

/** Public home page: about the Faculty, its departments, and the timetables for each programme. */
export default async function HomePage() {
  const [me, published] = await Promise.all([getCurrentUser(), getPublishedSemesters()]);
  const current = published[0];

  return (
    <div className="home">
      <header className="h-hero">
        <div className="h-bar">
          <div className="h-id">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/crest.png" alt="University of Benin crest" />
            <span>
              <small>{SITE.university}</small>
              <b>{SITE.faculty}</b>
            </span>
          </div>
          {me ? (
            <Link className="h-staff" href="/timetable">
              Go to workspace →
            </Link>
          ) : (
            <Link className="h-staff" href="/login">
              Staff sign in
            </Link>
          )}
        </div>
        <div className="h-lead">
          <p className="h-kicker">Timetables</p>
          <h1>{SITE.faculty}</h1>
          <p className="h-tag">{SITE.tagline}</p>
          <div className="h-cta">
            <Link className="h-btn primary" href="/view">
              Find my lecture timetable
            </Link>
            <a className="h-btn" href="#programmes">
              All timetables
            </a>
          </div>
          {current && (
            <p className="h-now">
              Now published: <b>{current.session} {current.name}</b> undergraduate lecture timetable
            </p>
          )}
        </div>
      </header>

      <main className="h-main">
        <section className="h-about">
          <div>
            <h2>About the Faculty</h2>
            {SITE.about.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div>
            <h2>Departments</h2>
            <ul className="h-depts">
              {FACULTY_DEPARTMENTS.map((d) => (
                <li key={d.code}>
                  <span className="code">{d.code}</span>
                  {d.name}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="programmes" className="h-progs">
          <h2>Timetables by programme</h2>
          <div className="h-grid">
            {PROGRAMMES.map((prog) => (
              <article key={prog.id} className={`h-prog ${prog.id}`}>
                <header>
                  <h3>{prog.title}</h3>
                  <p>{prog.subtitle}</p>
                </header>
                <ul>
                  {prog.schedules.map((s) => {
                    const live = s.status === "live" && s.href;
                    const note =
                      s.href === "/view" ? (current ? `${current.session} ${current.name}` : "Not yet published") : s.staffOnly ? "Staff" : "";
                    const body = (
                      <>
                        <span className="l">
                          <b>{s.label}</b>
                          <small>{s.hint}</small>
                        </span>
                        <span className={`badge${live && !(s.href === "/view" && !current) ? " live" : ""}`}>{live ? note || "Open" : "Coming soon"}</span>
                      </>
                    );
                    return (
                      <li key={s.label}>
                        {live ? (
                          <Link href={s.href!} className="h-link">
                            {body}
                          </Link>
                        ) : (
                          <div className="h-link off" aria-disabled="true">
                            {body}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="h-foot">
        <span>
          {SITE.faculty} · {SITE.university}
        </span>
        <Link href="/login">Staff sign in</Link>
      </footer>
    </div>
  );
}
