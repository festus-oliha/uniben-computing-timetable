import Link from "next/link";
import { getPublishedSemesters } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth/session";
import { FACULTY_DEPARTMENTS, MODULES, SITE } from "@/lib/site-content";
import { FacomsMark } from "@/components/brand/FacomsLogo";
import { ModuleIcon } from "@/components/brand/ModuleIcon";
import { SiteFooter, UnibenStrip } from "@/components/brand/SiteChrome";
import { getHomeContent } from "@/lib/site-data";
import { hasHomeContent, paragraphs } from "@/lib/home-content";
import "./home.css";

export const metadata = {
  title: "FaCoMS — Faculty of Computing Management System, University of Benin",
  description: "Projects, seminars, timetables, staff and records for the Faculty of Computing, University of Benin.",
};

/** FaCoMS home: the modules first, then about the Faculty and its departments. */
export default async function HomePage() {
  const [me, published, home] = await Promise.all([getCurrentUser(), getPublishedSemesters(), getHomeContent()]);
  const showLeaders = hasHomeContent(home);
  const current = published[0];

  return (
    <div className="home">
      <UnibenStrip signedIn={!!me} />
      <header className="hx">
        <div className="hx-in">
          <div className="hx-brand">
            <FacomsMark size={84} />
            <div>
              <h1 className="hx-word">FaCoMS</h1>
              <p className="hx-full">{SITE.fullName}</p>
            </div>
          </div>
          <p className="hx-tag">
            {SITE.faculty}, University of Benin. {SITE.tagline}
          </p>
        </div>

        <nav className="board" aria-label="FaCoMS modules">
          {MODULES.map((m) => {
            const live = m.status === "live";
            return (
              <Link key={m.slug} href={m.href} className={`port ${live ? "live" : "soon"}`}>
                <span className="port-icon">
                  <ModuleIcon slug={m.slug} />
                </span>
                <span className="port-name">{m.name}</span>
                <span className="port-purpose">{m.purpose}</span>
                <span className="port-state">
                  {live
                    ? m.slug === "timetable" && current
                      ? `Open: ${current.session} ${current.name} published`
                      : "Open"
                    : m.staffOnly
                      ? "Being built (staff only)"
                      : "Being built"}
                </span>
              </Link>
            );
          })}
        </nav>
      </header>

      {showLeaders ? (
        <section className="lead" aria-label="The Dean and the Faculty's mission">
          {(home.dean.name || home.dean.photo || home.dean.profile) && (
            <article className="dean">
              <div className="dean-photo">
                {home.dean.photo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={home.dean.photo} alt={home.dean.name ? `${home.dean.name}, ${home.dean.title}` : home.dean.title} />
                ) : (
                  <FacomsMark size={96} />
                )}
              </div>
              <div className="dean-text">
                <h2>From the Dean</h2>
                {home.dean.name && <p className="dean-name">{home.dean.name}</p>}
                <p className="dean-title">{home.dean.title}</p>
                {paragraphs(home.dean.profile).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </article>
          )}
          {(home.mission || home.vision) && (
            <div className="mv">
              {home.mission && (
                <div className="mv-block mission">
                  <h2>Our mission</h2>
                  <p>{home.mission}</p>
                </div>
              )}
              {home.vision && (
                <div className="mv-block">
                  <h2>Our vision</h2>
                  <p>{home.vision}</p>
                </div>
              )}
            </div>
          )}
        </section>
      ) : me?.role === "admin" ? (
        <p className="lead-empty">
          The Dean&apos;s profile and the Faculty&apos;s mission will appear here. <Link href="/settings">Add them in Settings → Home page</Link>.
        </p>
      ) : null}

      <main className="hm">
        <section className="hm-about" aria-labelledby="about-h">
          <h2 id="about-h">About the Faculty of Computing</h2>
          {SITE.about.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p>
            <a href={SITE.universityUrl} target="_blank" rel="noopener" className="hm-uni">
              Visit the University of Benin website
            </a>
          </p>
        </section>
        <section className="hm-depts" aria-labelledby="dept-h">
          <h2 id="dept-h">Departments</h2>
          <ul>
            {FACULTY_DEPARTMENTS.map((d) => (
              <li key={d.code}>
                <Link href={`/departments/${d.code.toLowerCase()}`}>
                  <span className="code">{d.code}</span>
                  <span>{d.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
