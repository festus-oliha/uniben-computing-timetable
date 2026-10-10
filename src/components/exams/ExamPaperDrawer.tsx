"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DEPARTMENTS, codesOf, levelName, levelOf, prefixOf } from "@/lib/timetable";
import { dateLabel, examIssues, parseVenues } from "@/lib/exam";
import { outsideDeptMessage, type Actor } from "@/lib/permissions";
import type { ExamBoardData, ExamPaperDTO } from "@/lib/types";
import { deleteExamPaper, saveExamPaper } from "@/app/exam-actions";
import { useToast } from "../Toast";

interface Props {
  state: { mode: "new" | "edit"; paper: ExamPaperDTO };
  data: ExamBoardData;
  papers: ExamPaperDTO[];
  actor: Actor;
  canEdit: (p: { kind: string; label: string }) => boolean;
  onClose: () => void;
}

/** Side panel for adding or editing one examination paper or block, with a live clash preview. */
export function ExamPaperDrawer({ state, data, papers, actor, canEdit, onClose }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ExamPaperDTO>(state.paper);
  const [venueText, setVenueText] = useState(state.paper.venues.join(", "));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const t = data.timetable;

  useEffect(() => {
    setDraft(state.paper);
    setVenueText(state.paper.venues.join(", "));
    setConfirmDelete(false);
    first.current?.focus();
  }, [state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof ExamPaperDTO>(k: K, v: ExamPaperDTO[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const readOnly = state.mode === "edit" && !canEdit(state.paper);
  const mayKeep = !draft.label.trim() || canEdit({ kind: draft.kind, label: draft.label.toUpperCase() });

  const courseMap = useMemo(() => new Map(data.courses.map((c) => [c.code, c])), [data.courses]);
  const names = useMemo(() => new Map(data.lecturers.map((l) => [l.id, l.name])), [data.lecturers]);
  const label = draft.kind === "paper" ? draft.label.toUpperCase().replace(/\s+/g, "") : draft.label.trim();
  const codes = draft.kind === "paper" ? codesOf(label) : [];

  const preview = useMemo(() => {
    if (!label) return [];
    const me = { ...draft, label, id: "__draft" };
    const ctx = { course: (c: string) => courseMap.get(c), lecturerName: (id: string) => names.get(id) };
    return examIssues([...papers.filter((p) => p.id !== draft.id), me], ctx).filter((i) => i.paperIds.includes("__draft"));
  }, [draft, label, papers, courseMap, names]);

  const toggleVenue = (code: string) => {
    const vs = parseVenues(venueText);
    setVenueText((vs.includes(code) ? vs.filter((v) => v !== code) : [...vs, code]).join(", "));
  };
  const chosen = parseVenues(venueText);
  const lectureVenues = data.venues.filter((v) => v.inLectureGrid);
  const examVenues = data.venues.filter((v) => !v.inLectureGrid);

  function save() {
    startTransition(async () => {
      const r = await saveExamPaper({
        id: state.mode === "edit" ? draft.id : undefined,
        timetableId: t.id,
        date: draft.date,
        session: draft.session,
        label: draft.label,
        kind: draft.kind,
        venues: chosen,
        year: draft.year,
        note: draft.note,
      });
      if (r.ok) {
        toast(r.message ?? "Saved.");
        router.refresh();
        onClose();
      } else toast(r.error, true);
    });
  }

  function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    startTransition(async () => {
      const r = await deleteExamPaper(draft.id);
      if (r.ok) {
        toast(r.message ?? "Deleted.");
        router.refresh();
        onClose();
      } else toast(r.error, true);
    });
  }

  return (
    <div className="drawer" role="dialog" aria-modal="false" aria-labelledby="xdrawer-title">
      <header>
        <h3 id="xdrawer-title">{state.mode === "new" ? "Add to the exam timetable" : readOnly ? "Paper details" : "Edit paper"}</h3>
        <button type="button" className="xbtn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="body">
        {readOnly && <p className="readonly-note">{outsideDeptMessage(actor)}</p>}
        {!readOnly && !mayKeep && <p className="issue">{outsideDeptMessage(actor)}</p>}
        <fieldset disabled={readOnly} className="plain">
          <div className="seg" role="tablist" aria-label="Entry type">
            <button type="button" role="tab" aria-selected={draft.kind === "paper"} onClick={() => set("kind", "paper")}>
              Paper
            </button>
            <button type="button" role="tab" aria-selected={draft.kind === "block"} onClick={() => set("kind", "block")} disabled={actor.role !== "admin" && t.dept === null}>
              Whole-session block
            </button>
          </div>
          <label className="fld">
            <span>{draft.kind === "paper" ? "Course code(s)" : "Block name"}</span>
            <input ref={first} id="paper-label" value={draft.label} onChange={(e) => set("label", e.target.value)} placeholder={draft.kind === "paper" ? "CSC313 or CSC313/CSC301" : "GST"} />
          </label>
          <p className="hint" style={{ margin: 0 }}>
            {draft.kind === "paper"
              ? "Use a slash for courses written together in one paper, e.g. CSC313/CSC301."
              : "A block fills the whole session, e.g. GST or CED examinations held by another unit."}
          </p>
          <div className="row2">
            <label className="fld">
              <span>Date</span>
              <select id="paper-date" value={draft.date} onChange={(e) => set("date", e.target.value)}>
                {t.dates.map((d) => (
                  <option key={d} value={d}>
                    {dateLabel(d).day} {dateLabel(d).date}
                  </option>
                ))}
              </select>
            </label>
            <label className="fld">
              <span>Session</span>
              <select id="paper-session" value={draft.session} onChange={(e) => set("session", Number(e.target.value))}>
                {t.sessions.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {draft.kind === "paper" && (
            <>
              {t.programme === "pt" && (
                <label className="fld">
                  <span>Year group</span>
                  <select id="paper-year" value={draft.year ?? ""} onChange={(e) => set("year", e.target.value || null)}>
                    <option value="">—</option>
                    {["Y1", "Y2", "Y3", "Y4", "Y5", "Y6"].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="fld">
                <span>Venues</span>
                <input id="paper-venues" value={venueText} onChange={(e) => setVenueText(e.target.value)} placeholder="W, T, P1" />
                <div className="venue-pick" aria-label="Pick venues">
                  {lectureVenues.map((v) => (
                    <button key={v.code} type="button" aria-pressed={chosen.includes(v.code)} title={v.name} onClick={() => toggleVenue(v.code)}>
                      {v.code}
                    </button>
                  ))}
                  {examVenues.length > 0 && <span className="sep">Other examination venues</span>}
                  {examVenues.map((v) => (
                    <button key={v.code} type="button" aria-pressed={chosen.includes(v.code)} title={v.name} onClick={() => toggleVenue(v.code)}>
                      {v.code}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <label className="fld">
            <span>Note</span>
            <input id="paper-note" value={draft.note} onChange={(e) => set("note", e.target.value)} placeholder="Optional, e.g. CBT" />
          </label>
          {codes.length > 0 && (
            <div className="hint">
              {codes.map((c) => {
                const info = courseMap.get(c);
                const lv = info?.level ?? levelOf(c);
                const lecturers = (info?.lecturerIds ?? []).map((id) => names.get(id)).filter(Boolean);
                return (
                  <div key={c}>
                    {c}: {lv ? levelName(lv) : "—"} · {DEPARTMENTS[info?.dept ?? prefixOf(c)] ?? info?.dept ?? prefixOf(c)}
                    {info?.isCommon ? " · common" : ""}
                    {lecturers.length ? ` · ${lecturers.join(", ")}` : ""}
                  </div>
                );
              })}
            </div>
          )}
        </fieldset>
        {preview.map((i, k) => (
          <div key={k} className={`issue${i.severity === "warning" ? " warn" : ""}`}>
            {i.message}
          </div>
        ))}
      </div>
      <div className="actions">
        {!readOnly && (
          <button type="button" className="btn primary" onClick={save} disabled={pending || !draft.label.trim() || !mayKeep}>
            {pending ? "Saving…" : "Save"}
          </button>
        )}
        <button type="button" className="btn" onClick={onClose}>
          {readOnly ? "Close" : "Cancel"}
        </button>
        {state.mode === "edit" && !readOnly && (
          <button type="button" className={`btn danger${confirmDelete ? " sure" : ""}`} onClick={remove} disabled={pending}>
            {confirmDelete ? "Confirm delete" : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}
