"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABEL, CATEGORY_MARK, type CourseCategory, type PCourse } from "@/lib/programme";
import { printName } from "@/lib/invigilation";
import type { ProgrammeBoardData } from "@/lib/types";
import { deleteProgrammeCourse, reorderProgrammeCourse, saveProgrammeCourse } from "@/app/programme-actions";
import { useToast } from "../Toast";

type Draft = { id?: string; code: string; title: string; category: CourseCategory; semester: number; lecturerIds: string[] };
const empty = (semester: number): Draft => ({ code: "", title: "", category: "core", semester, lecturerIds: [] });

/** The course allocation list: code, title, core / mandatory / elective, and lecturers — first and second semester. */
export function CourseAllocation({ data, canManage, semester }: { data: ProgrammeBoardData; canManage: boolean; semester: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const person = new Map(data.lecturers.map((l) => [l.id, l]));

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok || r.message) toast((r.ok ? r.message : r.error) ?? "", !r.ok);
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  const save = (d: Draft) => run(() => saveProgrammeCourse({ ...d, timetableId: data.timetable.id }), () => setEditing(null));

  const section = (sem: number) => {
    const list = data.courses.filter((c) => c.semester === sem);
    return (
      <div key={sem}>
        <h3 className="sub">
          {sem === 1 ? "First" : "Second"} semester {sem === semester ? <span className="pill ok">this timetable</span> : null}
        </h3>
        <div className="tblwrap">
          <table className="t alloc">
            <thead>
              <tr>
                <th>#</th>
                <th>Code</th>
                <th>Title</th>
                <th>Type</th>
                <th>Lecturer(s)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && !(editing && !editing.id && editing.semester === sem) && (
                <tr>
                  <td colSpan={6} className="empty">
                    No courses listed yet.
                  </td>
                </tr>
              )}
              {list.map((c: PCourse, i) =>
                editing?.id === c.id ? (
                  <Editor key={c.id} d={editing} lecturers={data.lecturers} pending={pending} onSave={save} onCancel={() => setEditing(null)} />
                ) : (
                  <tr key={c.id}>
                    <td className="num">{i + 1}.</td>
                    <td className="code">
                      {CATEGORY_MARK[c.category]}
                      {c.code}
                    </td>
                    <td>{c.title}</td>
                    <td>{CATEGORY_LABEL[c.category]}</td>
                    <td>{c.lecturerIds.map((id) => person.get(id)?.name ?? "?").join("; ") || <span className="hint">Not assigned</span>}</td>
                    <td className="nowrap">
                      {canManage && (
                        <>
                          <button type="button" className="btn" aria-label={`Move ${c.code} up`} disabled={i === 0 || pending} onClick={() => run(() => reorderProgrammeCourse(c.id, -1))}>
                            ↑
                          </button>{" "}
                          <button type="button" className="btn" aria-label={`Move ${c.code} down`} disabled={i === list.length - 1 || pending} onClick={() => run(() => reorderProgrammeCourse(c.id, 1))}>
                            ↓
                          </button>{" "}
                          <button type="button" className="btn" onClick={() => setEditing({ ...c })}>
                            Edit
                          </button>{" "}
                          <button type="button" className={`btn danger${confirm === c.id ? " sure" : ""}`} onClick={() => (confirm === c.id ? run(() => deleteProgrammeCourse(c.id), () => setConfirm(null)) : setConfirm(c.id))}>
                            {confirm === c.id ? "Confirm" : "Remove"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ),
              )}
              {editing && !editing.id && editing.semester === sem && <Editor d={editing} lecturers={data.lecturers} pending={pending} onSave={save} onCancel={() => setEditing(null)} />}
            </tbody>
          </table>
        </div>
        {canManage && !editing && (
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => setEditing(empty(sem))}>
            Add a {sem === 1 ? "first" : "second"}-semester course
          </button>
        )}
      </div>
    );
  };

  return (
    <section className="card">
      <h2>Course allocation</h2>
      <p className="hint">
        Printed with the timetable, marked {CATEGORY_MARK.core} core, {CATEGORY_MARK.mandatory} mandatory, {CATEGORY_MARK.elective} elective. Lecturers named here are used for clash checks. Add staff on the Lecturers tab (you can paste a list).
      </p>
      {section(1)}
      {section(2)}
    </section>
  );
}

function Editor({ d, lecturers, pending, onSave, onCancel }: { d: Draft; lecturers: ProgrammeBoardData["lecturers"]; pending: boolean; onSave: (d: Draft) => void; onCancel: () => void }) {
  const person = new Map(lecturers.map((l) => [l.id, l]));
    const [x, setX] = useState(d);
    const [add, setAdd] = useState("");
    return (
      <tr className="editing">
        <td />
        <td>
          <input aria-label="Course code" className="code-in" value={x.code} onChange={(e) => setX({ ...x, code: e.target.value })} placeholder="CSC801" autoFocus />
        </td>
        <td>
          <input aria-label="Course title" value={x.title} onChange={(e) => setX({ ...x, title: e.target.value })} placeholder="Current Topics in Computer Systems" style={{ width: "100%" }} />
        </td>
        <td>
          <select aria-label="Category" value={x.category} onChange={(e) => setX({ ...x, category: e.target.value as CourseCategory })}>
            {(["core", "mandatory", "elective", ""] as CourseCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <select aria-label="Semester" value={x.semester} onChange={(e) => setX({ ...x, semester: Number(e.target.value) })}>
            <option value={1}>1st sem.</option>
            <option value={2}>2nd sem.</option>
          </select>
        </td>
        <td>
          <div className="people">
            {x.lecturerIds.map((id) => (
              <span key={id} className="person">
                {person.has(id) ? printName(person.get(id)!) : "?"}
                <button type="button" aria-label="Remove lecturer" onClick={() => setX({ ...x, lecturerIds: x.lecturerIds.filter((y) => y !== id) })}>
                  ×
                </button>
              </span>
            ))}
            <select aria-label="Add lecturer" value={add} onChange={(e) => (setX({ ...x, lecturerIds: [...x.lecturerIds, e.target.value] }), setAdd(""))}>
              <option value="">+ lecturer…</option>
              {lecturers
                .filter((l) => !x.lecturerIds.includes(l.id))
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </div>
        </td>
        <td className="nowrap">
          <button type="button" className="btn primary" disabled={pending || !x.code.trim()} onClick={() => onSave(x)}>
            Save
          </button>{" "}
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </td>
      </tr>
    );
  }
