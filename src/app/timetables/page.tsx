import Link from "next/link";
import { getPublishedSemesters } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth/session";
import { PROGRAMMES } from "@/lib/site-content";
import { ModuleHeader, SiteFooter } from "@/components/brand/SiteChrome";
import "./timetables.css";

export const metadata = {
  title: "Timetables — FaCoMS, University of Benin",
  description: "Lecture, examination and invigilation timetables for the Faculty of Computing, University of Benin.",
};

/** The Timetable module: every published timetable by programme, and the way into the staff workspace. */
export default async function TimetablesPage() {
  const [me, published] = await Promise.all([getCurrentUser(), getPublishedSemesters()]);
  const current = published[0];

  return (
    <div className="tt">
      <ModuleHeader module="Timetable" signedIn={!!me} />
      <section className="tt-lead">
        <div>
          <h1>Timetables</h1>
          <p>Lecture, examination and invigilation timetables for every programme in the Faculty of Computing.</p>
        </div>
        <div className="tt-actions">
          <Link className="tt-btn primary" href="/view">
            Find my lecture timetable
          </Link>
          <Link className="tt-btn" href={me ? "/timetable" : "/login?next=/timetable"}>
            {me ? "Open the timetable workspace" : "Staff: sign in to the workspace"}
          </Link>
        </div>
      </section>

      <main className="tt-main">
        <div className="h-grid">
          {PROGRAMMES.map((prog) => (
            <article key={prog.id} className={`h-prog ${prog.id}`}>
              <header>
                <h2>{prog.title}</h2>
                <p>{prog.subtitle}</p>
              </header>
              <ul>
                {prog.schedules.map((s) => {
                  const live = s.status === "live" && s.href;
                  const note = s.href === "/view" ? (current ? `${current.session} ${current.name}` : "Not yet published") : s.staffOnly ? "For invigilators" : "";
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
      </main>
      <SiteFooter />
    </div>
  );
}
