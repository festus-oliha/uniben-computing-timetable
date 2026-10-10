"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DEPARTMENTS, FACULTY_DEPTS } from "@/lib/timetable";
import { hoursByCourse } from "@/lib/clash";
import type { TimetableData } from "@/lib/types";
import { addLecturer, deleteLecturer } from "@/app/actions";
import { useToast } from "./Toast";
import { canManageLecturer, type Actor } from "@/lib/permissions";

export function LecturersPanel({ data, actor }: { data: TimetableData; actor: Actor }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [dept, setDept] = useState<string>(actor.role === "dept_officer" && actor.dept ? actor.dept : FACULTY_DEPTS[0]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const hours = useMemo(() => hoursByCourse(data.bookings), [data.bookings]);

  function add() {
    startTransition(async () => {
      const r = await addLecturer(name, dept);
      toast(r.ok ? r.message ?? "Added." : r.error, !r.ok);
      if (r.ok) {
        setName("");
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (confirming !== id) return setConfirming(id);
    startTransition(async () => {
      const r = await deleteLecturer(id);
      toast(r.ok ? r.message ?? "Removed." : r.error, !r.ok);
      setConfirming(null);
      if (r.ok) router.refresh();
    });
  }

  return (
    <section className="card">
      <h2>Lecturers</h2>
      <p className="hint">
        Add lecturers here, then assign them on the Courses tab. The timetable flags any lecturer booked in two places at
        once.
      </p>
      <div className="tblwrap">
        <table className="t">
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Courses</th>
              <th>Hours / week</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.lecturers.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  No lecturers yet. Add the first one below, then assign courses on the Courses tab.
                </td>
              </tr>
            )}
            {data.lecturers.map((l) => {
              const cs = data.courses.filter((c) => c.lecturerIds.includes(l.id)).map((c) => c.code);
              const h = cs.reduce((a, c) => a + (hours.get(c) ?? 0), 0);
              return (
                <tr key={l.id}>
                  <td>
                    <b>{l.name}</b>
                  </td>
                  <td>{l.dept ? DEPARTMENTS[l.dept] ?? l.dept : ""}</td>
                  <td className="code">{cs.length ? cs.join(", ") : <span className="hint">None yet</span>}</td>
                  <td className="num">{h}</td>
                  <td>
                    {canManageLecturer(actor, l) && (
                      <button type="button" className={`btn danger${confirming === l.id ? " sure" : ""}`} onClick={() => remove(l.id)}>
                        {confirming === l.id ? "Confirm remove" : "Remove"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {actor.role === "viewer" ? (
        <p className="readonly-note">You have view-only access.</p>
      ) : (
      <form
        className="addrow"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className="fld">
          <span>Name</span>
          <input id="lecturer-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. A. B. Surname" />
        </label>
        <label className="fld">
          <span>Department</span>
          <select id="lecturer-dept" value={dept} onChange={(e) => setDept(e.target.value)} disabled={actor.role !== "admin"}>
            {FACULTY_DEPTS.map((d) => (
              <option key={d} value={d}>
                {DEPARTMENTS[d]}
              </option>
            ))}
          </select>
        </label>
        <button className="btn primary" type="submit">
          Add lecturer
        </button>
      </form>
      )}
    </section>
  );
}
