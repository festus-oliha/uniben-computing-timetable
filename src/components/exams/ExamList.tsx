"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExamTimetable } from "@/app/exam-actions";
import { PROGRAMMES, PROGRAMME_ORDER, defaultExamWeekdays, type Programme } from "@/lib/programmes";
import { DEPARTMENTS, FACULTY_DEPTS } from "@/lib/timetable";
import { canManageExamTimetable, type Actor } from "@/lib/permissions";
import { dateLabel, datesBetween } from "@/lib/exam";
import type { ExamTimetableDTO } from "@/lib/types";
import { useToast } from "../Toast";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ExamList(props: { semester: { id: number; label: string }; timetables: (ExamTimetableDTO & { paperCount: number })[]; actor: Actor }) {
  const { semester, timetables, actor } = props;
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  // Programmes this person can start: the Faculty Officer any; a department officer only their department's.
  const allowed = PROGRAMME_ORDER.filter((p) => canManageExamTimetable(actor, { dept: PROGRAMMES[p].deptScoped ? actor.dept ?? "CSC" : null }));
  const [programme, setProgramme] = useState<Programme>(allowed[0] ?? "ug");
  const [dept, setDept] = useState<string>(actor.role === "dept_officer" && actor.dept ? actor.dept : "CSC");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>(defaultExamWeekdays(allowed[0] ?? "ug"));
  const count = start && end ? datesBetween(start, end, weekdays).length : 0;

  function pickProgramme(p: Programme) {
    setProgramme(p);
    setWeekdays(defaultExamWeekdays(p));
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await createExamTimetable({ semesterId: semester.id, programme, dept: PROGRAMMES[programme].deptScoped ? dept : null, start, end, weekdays });
      if (r.ok && r.id) {
        toast(r.message ?? "Created.");
        router.push(`/exams/${r.id}`);
      } else if (!r.ok) toast(r.error, true);
    });
  }

  const range = (t: ExamTimetableDTO) => (t.dates.length ? `${dateLabel(t.dates[0]).full} – ${dateLabel(t.dates.at(-1)!).full}` : "No dates");

  return (
    <>
      <section className="card">
        <h2>Examination timetables · {semester.label}</h2>
        {timetables.length === 0 ? (
          <p className="empty">No examination timetable has been started for this semester yet.</p>
        ) : (
          <div className="tblwrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Programme</th>
                  <th>Department</th>
                  <th>Dates</th>
                  <th className="num">Papers</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {timetables.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <b>{PROGRAMMES[t.programme as Programme]?.label ?? t.programme}</b>
                    </td>
                    <td>{t.dept ? DEPARTMENTS[t.dept] ?? t.dept : "Whole faculty"}</td>
                    <td className="num">
                      {range(t)} <span className="hint">({t.dates.length} days)</span>
                    </td>
                    <td className="num">{t.paperCount}</td>
                    <td>
                      <span className={`pill ${t.isPublished ? "ok" : "warn"}`}>{t.isPublished ? "Published" : "Draft"}</span>{" "}
                      {t.signedOn && <span className="pill ok">Signed</span>}
                    </td>
                    <td>
                      <Link className="btn" href={`/exams/${t.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {allowed.length > 0 && (
        <section className="card">
          <h2>New examination timetable</h2>
          <form className="new-sem" onSubmit={create}>
            <label className="fld">
              <span>Programme</span>
              <select id="exam-programme" value={programme} onChange={(e) => pickProgramme(e.target.value as Programme)}>
                {allowed.map((p) => (
                  <option key={p} value={p}>
                    {PROGRAMMES[p].label}
                  </option>
                ))}
              </select>
            </label>
            {PROGRAMMES[programme].deptScoped && (
              <label className="fld">
                <span>Department</span>
                <select id="exam-dept" value={dept} onChange={(e) => setDept(e.target.value)} disabled={actor.role !== "admin"}>
                  {FACULTY_DEPTS.map((d) => (
                    <option key={d} value={d}>
                      {DEPARTMENTS[d] ?? d}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="fld">
              <span>First exam date</span>
              <input id="exam-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
            </label>
            <label className="fld">
              <span>Last exam date</span>
              <input id="exam-end" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} required />
            </label>
            <fieldset className="copy-modes">
              <legend>Examination days</legend>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {WEEKDAYS.map((d, i) => (
                  <label key={d} className="toggle-row">
                    <input type="checkbox" checked={weekdays.includes(i)} onChange={(e) => setWeekdays((w) => (e.target.checked ? [...w, i].sort() : w.filter((x) => x !== i)))} />
                    {d}
                  </label>
                ))}
              </div>
              <small className="hint">
                {count ? `${count} examination days.` : "Pick the dates to see how many examination days that gives."} You can add or remove single dates later under Set-up.
              </small>
            </fieldset>
            <div>
              <button className="btn primary" disabled={pending || !count}>
                {pending ? "Creating…" : "Create timetable"}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
