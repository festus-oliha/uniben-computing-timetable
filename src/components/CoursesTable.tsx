"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DEPARTMENTS } from "@/lib/timetable";
import { hoursByCourse } from "@/lib/clash";
import type { CourseDTO, TimetableData } from "@/lib/types";
import { addCourse, saveCourse } from "@/app/actions";
import { useToast } from "./Toast";
import { canChangeCourseScope, canEditCourse, type Actor } from "@/lib/permissions";

export function CoursesTable({ data, actor }: { data: TimetableData; actor: Actor }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [newCode, setNewCode] = useState("");
  const hours = useMemo(() => hoursByCourse(data.bookings), [data.bookings]);

  const rows = data.courses.filter(
    (c) => (!q || c.code.includes(q.trim().toUpperCase())) && (!level || String(c.level) === level),
  );

  function update(c: CourseDTO, patch: Partial<CourseDTO> & { lecturerId?: string | null }) {
    const next = { ...c, ...patch };
    const lecturerId = "lecturerId" in patch ? patch.lecturerId ?? null : c.lecturerIds[0] ?? null;
    startTransition(async () => {
      const r = await saveCourse({
        code: c.code,
        level: next.level,
        dept: next.dept,
        units: next.units,
        isCommon: next.isCommon,
        lecturerId,
      });
      toast(r.ok ? r.message ?? "Saved." : r.error, !r.ok);
      if (r.ok) router.refresh();
    });
  }

  function add() {
    startTransition(async () => {
      const r = await addCourse(newCode);
      toast(r.ok ? r.message ?? "Added." : r.error, !r.ok);
      if (r.ok) {
        setNewCode("");
        router.refresh();
      }
    });
  }

  return (
    <section className="card">
      <h2>Courses</h2>
      <p className="hint">
        Tick <b>Common</b> when every department at that level takes the course (COS, GST, CED…). Common courses are
        checked against every other course at their level. Units are compared with the hours on the timetable.
      </p>
      {actor.role === "dept_officer" && (
        <p className="readonly-note">
          You can edit {actor.dept} courses: level, units and lecturer. Only the Faculty Time-Table Officer changes a
          course&apos;s department or whether it is common.
        </p>
      )}
      {actor.role === "viewer" && <p className="readonly-note">You have view-only access.</p>}
      <div className="bar">
        <label>
          Search <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. CSC3" />
        </label>
        <label>
          Level
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}00
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="tblwrap">
        <table className="t">
          <thead>
            <tr>
              <th>Code</th>
              <th>Level</th>
              <th>Department</th>
              <th>Common</th>
              <th>Units</th>
              <th>Hours on timetable</th>
              <th>Lecturer</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No courses match.
                </td>
              </tr>
            )}
            {rows.map((c) => {
              const h = hours.get(c.code) ?? 0;
              const editable = canEditCourse(actor, c);
              const scope = editable && canChangeCourseScope(actor);
              return (
                <tr key={c.code}>
                  <td className="code">{c.code}</td>
                  <td>
                    <select value={c.level} disabled={!editable} onChange={(e) => update(c, { level: Number(e.target.value) })} aria-label={`${c.code} level`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}00
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={c.dept} disabled={!scope} onChange={(e) => update(c, { dept: e.target.value })} aria-label={`${c.code} department`}>
                      {!(c.dept in DEPARTMENTS) && <option value={c.dept}>{c.dept}</option>}
                      {Object.entries(DEPARTMENTS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={c.isCommon}
                      disabled={!scope}
                      onChange={(e) => update(c, { isCommon: e.target.checked })}
                      aria-label={`${c.code} is common`}
                    />
                  </td>
                  <td>
                    <input
                      className="units num"
                      type="number"
                      min={0}
                      max={12}
                      defaultValue={c.units ?? ""}
                      disabled={!editable}
                      onBlur={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        if (v !== c.units) update(c, { units: v });
                      }}
                      aria-label={`${c.code} units`}
                    />
                  </td>
                  <td className="num">
                    {h} h{" "}
                    {c.units != null &&
                      (h === c.units ? <span className="pill ok">matches</span> : <span className="pill warn">{c.units} units</span>)}
                  </td>
                  <td>
                    <select
                      value={c.lecturerIds[0] ?? ""}
                      disabled={!editable}
                      onChange={(e) => update(c, { lecturerId: e.target.value || null })}
                      aria-label={`${c.code} lecturer`}
                    >
                      <option value="">— Not assigned —</option>
                      {data.lecturers.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {actor.role === "viewer" ? null : (
      <form
        className="addrow"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className="fld">
          <span>New course code</span>
          <input id="new-course" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="CSC305" />
        </label>
        <button className="btn primary" type="submit">
          Add course
        </button>
      </form>
      )}
    </section>
  );
}
