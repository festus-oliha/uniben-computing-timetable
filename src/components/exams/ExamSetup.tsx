"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExamTimetable, setExamPublished, updateExamSetup } from "@/app/exam-actions";
import { dateLabel, datesBetween } from "@/lib/exam";
import type { ExamTimetableDTO } from "@/lib/types";
import { useToast } from "../Toast";

/** Title, sessions, dates, notes and signatory of one exam timetable — plus publishing and deleting it. */
export function ExamSetup({ t, usedDates }: { t: ExamTimetableDTO; usedDates: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(t.title);
  const [sessions, setSessions] = useState(t.sessions);
  const [dates, setDates] = useState(t.dates);
  const [notes, setNotes] = useState(t.notes);
  const [signatoryName, setSignatoryName] = useState(t.signatoryName);
  const [signatoryRole, setSignatoryRole] = useState(t.signatoryRole);
  const [one, setOne] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [published, setPublished] = useState(t.isPublished);
  const used = new Set(usedDates);

  function togglePublished(on: boolean) {
    setPublished(on); // optimistic: the box responds at once, and is put back if the change fails
    startTransition(async () => {
      const r = await setExamPublished(t.id, on);
      if (r.ok) {
        toast(r.message ?? "Saved.");
        router.refresh();
      } else {
        setPublished(!on);
        toast(r.error, true);
      }
    });
  }

  const addDates = (ds: string[]) => setDates((cur) => [...new Set([...cur, ...ds])].sort());

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast(r.message ?? "Saved.");
        if (after) after();
        else router.refresh();
      } else toast(r.error ?? "Something went wrong.", true);
    });
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => updateExamSetup(t.id, { title, sessions, dates, notes, signatoryName, signatoryRole }));
  };

  return (
    <>
      <section className="card">
        <h2>Publishing</h2>
        <label className="toggle-row">
          <input type="checkbox" checked={published} onChange={(e) => togglePublished(e.target.checked)} />
          Show this examination timetable on the public page
        </label>
        <p className="hint">{published ? "Students and staff can see it without signing in." : "Only signed-in staff can see it while it is a draft."}</p>
      </section>

      <form className="card" onSubmit={save}>
        <h2>Set-up</h2>
        <label className="fld">
          <span>Title (printed under the faculty name)</span>
          <input id="setup-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <h3 className="sub">Sessions each day</h3>
        <div className="list-edit">
          {sessions.map((s, i) => (
            <div key={i} className="li" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
              <input aria-label={`Session ${i + 1} name`} value={s.name} onChange={(e) => setSessions((all) => all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input aria-label={`Session ${i + 1} time`} value={s.time} onChange={(e) => setSessions((all) => all.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
              <button type="button" className="btn" disabled={sessions.length <= 1} onClick={() => setSessions((all) => all.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
          {sessions.length < 4 && (
            <div>
              <button type="button" className="btn" onClick={() => setSessions((all) => [...all, { name: "Session", time: "" }])}>
                Add a session
              </button>
            </div>
          )}
        </div>

        <h3 className="sub">Examination dates ({dates.length})</h3>
        <div className="date-chips">
          {dates.map((d) => (
            <span key={d}>
              {dateLabel(d).day} {dateLabel(d).date}
              <button type="button" aria-label={`Remove ${dateLabel(d).full}`} title={used.has(d) ? "Has papers — move them first" : "Remove this date"} disabled={used.has(d)} onClick={() => setDates((all) => all.filter((x) => x !== d))}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="addrow">
          <label className="fld">
            <span>Add one date</span>
            <input type="date" value={one} onChange={(e) => setOne(e.target.value)} />
          </label>
          <button type="button" className="btn" disabled={!one} onClick={() => (addDates([one]), setOne(""))}>
            Add date
          </button>
          <label className="fld">
            <span>Or add every weekday from</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="fld">
            <span>to</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className="btn" disabled={!from || !to} onClick={() => addDates(datesBetween(from, to, t.programme === "pt" ? [5, 6] : t.programme === "ug" ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]))}>
            Add range
          </button>
        </div>

        <h3 className="sub">Notes printed under the timetable</h3>
        <div className="list-edit">
          {notes.map((n, i) => (
            <div key={i} className="li">
              <textarea aria-label={`Note ${i + 1}`} rows={2} value={n} onChange={(e) => setNotes((all) => all.map((x, j) => (j === i ? e.target.value : x)))} />
              <button type="button" className="btn" onClick={() => setNotes((all) => all.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="btn" onClick={() => setNotes((all) => [...all, ""])}>
              Add a note
            </button>
          </div>
        </div>

        <h3 className="sub">Signed by</h3>
        <div className="row2">
          <label className="fld">
            <span>Name</span>
            <input id="setup-signatory" value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} placeholder="e.g. F. O. Oliha, PhD." />
          </label>
          <label className="fld">
            <span>Position</span>
            <input value={signatoryRole} onChange={(e) => setSignatoryRole(e.target.value)} />
          </label>
        </div>

        <div className="actions" style={{ padding: 0, marginTop: 16 }}>
          <button className="btn primary" disabled={pending}>
            {pending ? "Saving…" : "Save set-up"}
          </button>
        </div>
      </form>

      <section className="card">
        <h2>Delete this timetable</h2>
        <p className="hint">Removes the timetable and every paper on it. This cannot be undone.</p>
        <button type="button" className={`btn danger${confirmDelete ? " sure" : ""}`} disabled={pending} onClick={() => (confirmDelete ? run(() => deleteExamTimetable(t.id), () => router.push("/exams")) : setConfirmDelete(true))}>
          {confirmDelete ? "Confirm: delete the timetable" : "Delete timetable"}
        </button>
      </section>
    </>
  );
}
