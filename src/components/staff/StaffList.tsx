"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORIES, initials, type StaffCategory } from "@/lib/staff";
import { DEPARTMENTS } from "@/lib/timetable";
import { FACULTY_DEPARTMENTS } from "@/lib/site-content";
import { canManageLecturer, type Actor } from "@/lib/permissions";
import type { StaffDTO } from "@/lib/types";

export function StaffList({ staff, actor }: { staff: StaffDTO[]; actor: Actor }) {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState(actor.role === "dept_officer" && actor.dept ? actor.dept : "");
  const [cat, setCat] = useState("");
  const [showLeft, setShowLeft] = useState(false);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return staff.filter(
      (s) =>
        (showLeft || s.isActive) &&
        (!dept || (dept === "none" ? !s.dept : s.dept === dept)) &&
        (!cat || s.category === cat) &&
        words.every((w) => `${s.name} ${s.rank} ${s.position} ${s.email} ${s.staffNo} ${s.interests}`.toLowerCase().includes(w)),
    );
  }, [staff, q, dept, cat, showLeft]);

  const count = (d: string) => staff.filter((s) => s.isActive && s.dept === d).length;
  const missing = staff.filter((s) => s.isActive && (!s.rank || !s.dept)).length;

  return (
    <>
      <section className="staff-sum">
        {FACULTY_DEPARTMENTS.map((d) => (
          <button key={d.code} type="button" className={dept === d.code ? "on" : ""} onClick={() => setDept(dept === d.code ? "" : d.code)}>
            <b>{count(d.code)}</b>
            <span>{d.code}</span>
          </button>
        ))}
        <div className="total">
          <b>{staff.filter((s) => s.isActive).length}</b>
          <span>staff in all</span>
        </div>
      </section>

      <div className="bar">
        <label>
          Search
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, rank, email, interest…" aria-label="Search staff" />
        </label>
        <label>
          Department
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All</option>
            {FACULTY_DEPARTMENTS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
            <option value="none">No department</option>
          </select>
        </label>
        <label>
          Category
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All</option>
            {(Object.keys(CATEGORIES) as StaffCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c].plural}
              </option>
            ))}
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={showLeft} onChange={(e) => setShowLeft(e.target.checked)} /> Include staff who have left
        </label>
        <div className="exports">
          <a className="btn" href="/workspace/staff/export">
            Download Excel
          </a>
        </div>
      </div>
      {missing > 0 && <p className="hint">{missing} record{missing === 1 ? " is" : "s are"} missing a rank or department.</p>}

      <section className="card">
        {staff.length === 0 ? (
          <div className="empty">
            No staff yet.{" "}
            {actor.role !== "viewer" && (
              <>
                <Link href="/workspace/staff/import">Load your staff list</Link> from Excel, or <Link href="/workspace/staff/new">add people one by one</Link>.
              </>
            )}
          </div>
        ) : (
          <div className="tblwrap">
            <table className="t staff-t">
              <thead>
                <tr>
                  <th />
                  <th>Name</th>
                  <th>Rank</th>
                  <th>Department</th>
                  <th>Position</th>
                  <th>Contact</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id} className={s.isActive ? "" : "left"}>
                    <td>
                      {s.photoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img className="av" src={s.photoUrl} alt="" />
                      ) : (
                        <span className="av ini">{initials(s.name)}</span>
                      )}
                    </td>
                    <td>
                      <b>{s.name}</b>
                      <small className="sub">{CATEGORIES[s.category as StaffCategory]?.label ?? s.category}{s.isActive ? "" : ", has left"}</small>
                    </td>
                    <td>{s.rank || <span className="hint">—</span>}</td>
                    <td>{s.dept ? DEPARTMENTS[s.dept] ?? s.dept : <span className="hint">—</span>}</td>
                    <td>{s.position}</td>
                    <td className="contact">
                      {s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}
                      {s.phone && <span>{s.phone}</span>}
                    </td>
                    <td>
                      <Link className="btn" href={`/workspace/staff/${s.id}`}>
                        {canManageLecturer(actor, s) ? "Edit" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty">
                      Nobody matches. Clear the search or filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
