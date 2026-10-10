import { redirect } from "next/navigation";
import { clashesFor, getTimetableData } from "@/lib/data";
import { countUsers, getCurrentUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/permissions";
import { DEPARTMENTS } from "@/lib/timetable";
import { Nav } from "@/components/Nav";
import { logout } from "../auth-actions";

/** Everything behind sign-in: header, tabs and the signed-in person. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect((await countUsers()) === 0 ? "/setup" : "/login");

  const data = await getTimetableData();
  const errors = clashesFor(data).filter((c) => c.severity === "error").length;

  return (
    <>
      <div className="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/crest.png" alt="University of Benin crest" />
        <a className="brand" href="/" title="Faculty home page">
          <small>University of Benin</small>
          <h1>
            Faculty of Computing <span>Timetable</span>
          </h1>
        </a>
        {data.semester && (
          <div className="session">
            {data.semester.name}
            <b>{data.semester.session}</b>
            <span className={`pubtag${data.semester.isPublished ? " on" : ""}`}>{data.semester.isPublished ? "Published" : "Draft"}</span>
          </div>
        )}
        <div className="me">
          <b>{me.name}</b>
          <small>
            {ROLE_LABELS[me.role]}
            {me.role === "dept_officer" && me.dept ? ` · ${DEPARTMENTS[me.dept] ?? me.dept}` : ""}
          </small>
          <div className="me-links">
            <a href="/account">Account</a>
            <form action={logout}>
              <button type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </div>
      <Nav clashCount={errors} isAdmin={me.role === "admin"} />
      <main>{children}</main>
    </>
  );
}
