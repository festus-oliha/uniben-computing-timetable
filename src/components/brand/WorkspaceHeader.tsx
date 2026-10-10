import Link from "next/link";
import { ROLE_LABELS } from "@/lib/permissions";
import { DEPARTMENTS } from "@/lib/timetable";
import type { CurrentUser } from "@/lib/auth/session";
import { FacomsMark } from "./FacomsLogo";
import { logout } from "@/app/auth-actions";

/** Header for a FaCoMS module workspace (Staff, and later Projects, Seminars …). */
export function WorkspaceHeader({ module, me }: { module: string; me: CurrentUser }) {
  return (
    <div className="top">
      <a className="brand" href="/" title="FaCoMS home">
        <FacomsMark size={44} />
        <span>
          <small>FaCoMS · Faculty of Computing</small>
          <h1>
            {module} <span>workspace</span>
          </h1>
        </span>
      </a>
      <nav className="ws-switch" aria-label="Other workspaces">
        <Link href="/timetable">Timetable</Link>
        <Link href="/workspace/staff">Staff</Link>
      </nav>
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
  );
}
