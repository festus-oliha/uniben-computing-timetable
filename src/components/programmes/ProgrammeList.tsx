"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProgrammeTimetable } from "@/app/programme-actions";
import { PROGRAMMES, PROGRAMME_ORDER, type Programme } from "@/lib/programmes";
import { DEPARTMENTS, FACULTY_DEPTS } from "@/lib/timetable";
import { WEEKDAYS } from "@/lib/programme";
import { canManageProgrammeTimetable, type Actor } from "@/lib/permissions";
import type { ProgrammeTimetableDTO } from "@/lib/types";
import { useToast } from "../Toast";

type Row = ProgrammeTimetableDTO & { semesterLabel: string; classCount: number };

export function ProgrammeList(props: { semester: { id: number; label: string }; current: Row[]; earlier: Row[]; actor: Actor }) {
  const { semester, current, earlier, actor } = props;
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const kinds = PROGRAMME_ORDER.filter((p) => p !== "ug");
  const depts = FACULTY_DEPTS.filter((d) => canManageProgrammeTimetable(actor, { dept: d }));
  const [programme, setProgramme] = useState<Programme>("pt");
  const [dept, setDept] = useState<string>(depts[0] ?? "CSC");
  const copyable = [...current, ...earlier].filter((t) => t.programme === programme && t.dept === dept);
  const [copyFrom, setCopyFrom] = useState<string>("");

  function create(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await createProgrammeTimetable({ semesterId: semester.id, programme, dept, copyFrom: copyFrom ? Number(copyFrom) : null });
      if (r.ok && r.id) {
        toast(r.message ?? "Created.");
        router.push(`/programmes/${r.id}`);
      } else if (!r.ok) toast(r.error, true);
    });
  }

  const table = (rows: Row[], showSem: boolean) => (
    <div className="tblwrap">
      <table className="t">
        <thead>
          <tr>
            <th>Programme</th>
            <th>Department</th>
            {showSem && <th>Semester</th>}
            <th>Days</th>
            <th className="num">Classes</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>
                <b>{PROGRAMMES[t.programme as Programme]?.label ?? t.programme}</b>
              </td>
              <td>{DEPARTMENTS[t.dept] ?? t.dept}</td>
              {showSem && <td>{t.semesterLabel}</td>}
              <td>{t.days.map((d) => WEEKDAYS[d].slice(0, 3)).join(", ")}</td>
              <td className="num">{t.classCount}</td>
              <td>
                <span className={`pill ${t.isPublished ? "ok" : "warn"}`}>{t.isPublished ? "Published" : "Draft"}</span> {t.signedOn && <span className="pill ok">Signed</span>}
              </td>
              <td>
                <Link className="btn" href={`/programmes/${t.id}`}>
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <section className="card">
        <h2>Part-time &amp; postgraduate lecture timetables · {semester.label}</h2>
        {current.length ? table(current, false) : <p className="empty">None started for this semester yet.</p>}
      </section>

      {depts.length > 0 && (
        <section className="card">
          <h2>New timetable</h2>
          <form className="new-sem" onSubmit={create}>
            <label className="fld">
              <span>Programme</span>
              <select id="prog-programme" value={programme} onChange={(e) => (setProgramme(e.target.value as Programme), setCopyFrom(""))}>
                {kinds.map((p) => (
                  <option key={p} value={p}>
                    {PROGRAMMES[p].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="fld">
              <span>Department</span>
              <select id="prog-dept" value={dept} onChange={(e) => (setDept(e.target.value), setCopyFrom(""))} disabled={depts.length < 2}>
                {depts.map((d) => (
                  <option key={d} value={d}>
                    {DEPARTMENTS[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className="fld">
              <span>Start from</span>
              <select id="prog-copy" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                <option value="">The usual layout ({programme === "pt" ? "Fri & Sat, Years 1–6, hourly" : "Mon–Fri, 9–12 and 1–4"})</option>
                {copyable.map((t) => (
                  <option key={t.id} value={t.id}>
                    Copy {t.semesterLabel} ({t.classCount} classes)
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button className="btn primary" disabled={pending}>
                {pending ? "Creating…" : "Create timetable"}
              </button>
            </div>
          </form>
          <p className="hint">Days, rows, periods, venue letters and the calendar can all be changed afterwards under Set-up.</p>
        </section>
      )}

      {earlier.length > 0 && (
        <section className="card">
          <h2>Earlier semesters</h2>
          {table(earlier, true)}
        </section>
      )}
    </>
  );
}
