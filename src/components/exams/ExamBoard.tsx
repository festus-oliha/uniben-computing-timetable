"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { DEPARTMENTS, categoryOf, codesOf } from "@/lib/timetable";
import { dateLabel, examIssues, paperText, sessionNumber, unscheduled, weekOf, type ExamIssue } from "@/lib/exam";
import { canAddExamPapers, canEditExamPaper, type Actor } from "@/lib/permissions";
import type { ExamBoardData, ExamPaperDTO } from "@/lib/types";
import { moveExamPaper } from "@/app/exam-actions";
import { useToast } from "../Toast";
import { ExamPaperDrawer } from "./ExamPaperDrawer";

type Focus = { type: "all" | "level" | "dept" | "year"; value: string };

export function ExamBoard({ data, actor }: { data: ExamBoardData; actor: Actor }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const t = data.timetable;
  const isPT = t.programme === "pt";

  const [papers, setPapers] = useState(data.papers);
  useEffect(() => setPapers(data.papers), [data.papers]);
  const [drawer, setDrawer] = useState<{ mode: "new" | "edit"; paper: ExamPaperDTO } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string[]>([]);
  const [focus, setFocus] = useState<Focus>({ type: "all", value: "" });

  const ctx = useMemo(() => {
    const m = new Map(data.courses.map((c) => [c.code, c]));
    const names = new Map(data.lecturers.map((l) => [l.id, l.name]));
    return {
      course: (code: string) => m.get(code),
      lecturerName: (id: string) => names.get(id),
      lecturersOf: (label: string) => [...new Set(codesOf(label).flatMap((c) => m.get(c)?.lecturerIds ?? []))].map((id) => names.get(id)).filter(Boolean) as string[],
    };
  }, [data.courses, data.lecturers]);

  const issues = useMemo(() => examIssues(papers, ctx), [papers, ctx]);
  const missing = useMemo(() => unscheduled(data.taughtCodes, papers), [data.taughtCodes, papers]);
  const issueOf = useMemo(() => {
    const m = new Map<string, ExamIssue[]>();
    for (const i of issues) for (const id of i.paperIds) m.set(id, [...(m.get(id) ?? []), i]);
    return m;
  }, [issues]);

  const deptOf = (code: string) => ctx.course(code)?.dept ?? code.replace(/\d+$/, "");
  const canEdit = (p: { kind: string; label: string }) => canEditExamPaper(actor, t, p, deptOf);
  const canAdd = canAddExamPapers(actor, t);

  useEffect(() => {
    if (!flash.length) return;
    document.querySelector<HTMLElement>(`[data-paper="${CSS.escape(flash[0])}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const h = setTimeout(() => setFlash([]), 2600);
    return () => clearTimeout(h);
  }, [flash]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const p = papers.find((x) => x.id === e.active.id);
    const over = e.over?.data.current as { date: string; session: number } | undefined;
    if (!p || !over || (over.date === p.date && over.session === p.session)) return;
    const before = papers;
    setPapers((all) => all.map((x) => (x.id === p.id ? { ...x, ...over } : x)));
    startTransition(async () => {
      const r = await moveExamPaper(p.id, over.date, over.session);
      if (r.ok) {
        toast(r.message ?? "Moved.");
        router.refresh();
      } else {
        setPapers(before);
        toast(r.error, true);
      }
    });
  }

  const matches = (p: ExamPaperDTO) => {
    if (focus.type === "all" || !focus.value) return true;
    if (focus.type === "year") return p.year === focus.value;
    const cs = codesOf(p.label).map((c) => ({ code: c, info: ctx.course(c) }));
    if (focus.type === "level") return cs.some((c) => String(c.info?.level ?? c.code.match(/(\d)\d\d$/)?.[1]) === focus.value);
    return cs.some((c) => (c.info?.dept ?? deptOf(c.code)) === focus.value);
  };

  const focusOptions: [string, string][] =
    focus.type === "level"
      ? [["1", "100 Level"], ["2", "200 Level"], ["3", "300 Level"], ["4", "400 Level"], ["5", "500 Level"]]
      : focus.type === "dept"
        ? [...new Set(papers.flatMap((p) => codesOf(p.label).map(deptOf)))].sort().map((d) => [d, DEPARTMENTS[d] ?? d])
        : focus.type === "year"
          ? ["Y1", "Y2", "Y3", "Y4", "Y5", "Y6"].map((y) => [y, y])
          : [];

  const blank = (date: string, session: number, label = ""): ExamPaperDTO => ({ id: "", date, session, label, kind: "paper", venues: [], year: null, note: "", chiefId: null, invigilatorIds: [], assistantsNeeded: null });
  const dragged = dragId ? papers.find((p) => p.id === dragId) : null;
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const n = (type: ExamIssue["type"]) => issues.filter((i) => i.type === type).length;

  let lastWeek = 0;
  return (
    <>
      <div className="bar">
        <label>
          Focus
          <select value={focus.type} onChange={(e) => setFocus({ type: e.target.value as Focus["type"], value: "" })} aria-label="Focus on">
            <option value="all">Everything</option>
            <option value="level">Level</option>
            <option value="dept">Department</option>
            {isPT && <option value="year">Year group</option>}
          </select>
        </label>
        {focus.type !== "all" && (
          <label>
            <select value={focus.value} onChange={(e) => setFocus({ ...focus, value: e.target.value })} aria-label="Focus value">
              <option value="">Choose…</option>
              {focusOptions.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="hint">
          {papers.filter((p) => p.kind === "paper").length} papers · {t.dates.length} days · {t.sessions.length} session{t.sessions.length > 1 ? "s" : ""} a day
        </span>
      </div>

      {t.dates.length === 0 ? (
        <div className="card empty">This timetable has no dates yet. Add them under Set-up.</div>
      ) : (
        <div className="layout">
          <div className="scroller">
            <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
              <div className="xgrid" style={{ gridTemplateColumns: `104px repeat(${t.sessions.length}, minmax(190px, 1fr))` }}>
                <div className="h">DATE</div>
                {t.sessions.map((s, i) => (
                  <div key={i} className="h">
                    {s.name.toUpperCase()}
                    <small>{s.time}</small>
                  </div>
                ))}
                {t.dates.map((date, di) => {
                  const dl = dateLabel(date);
                  const wk = weekOf(t.dates, date);
                  const showWeek = isPT && wk !== lastWeek;
                  lastWeek = wk;
                  return [
                    showWeek ? (
                      <div key={`w-${date}`} className="xweek" style={{ gridColumn: "1 / -1" }}>
                        Week {wk}
                      </div>
                    ) : null,
                    <div key={`d-${date}`} className="xdate">
                      <b>{dl.day}</b>
                      <span>{dl.date}</span>
                    </div>,
                    ...t.sessions.map((_, si) => (
                      <XCell key={`${date}-${si}`} date={date} session={si} number={sessionNumber(di, si, t.sessions.length)} onAdd={canAdd ? () => setDrawer({ mode: "new", paper: blank(date, si) }) : null}>
                        {papers
                          .filter((p) => p.date === date && p.session === si)
                          .sort((a, b) => a.label.localeCompare(b.label))
                          .map((p) => (
                            <Chip
                              key={p.id}
                              paper={p}
                              editable={canEdit(p)}
                              issues={issueOf.get(p.id)}
                              dim={!matches(p)}
                              flash={flash.includes(p.id)}
                              dragging={dragId === p.id}
                              lecturers={ctx.lecturersOf(p.label)}
                              onOpen={() => setDrawer({ mode: "edit", paper: p })}
                            />
                          ))}
                      </XCell>
                    )),
                  ];
                })}
              </div>
              <DragOverlay dropAnimation={null}>{dragged ? <div className={`chip ${dragged.kind === "block" ? "gen" : categoryOf({ kind: "course", label: dragged.label })} drag-ghost`}>{paperText(dragged)}</div> : null}</DragOverlay>
            </DndContext>
          </div>
          <aside className="rail">
            <h2>Clash check</h2>
            <div className="sum">
              <div className={n("students") ? "bad" : ""}>
                <b>{n("students")}</b>
                <span>Student</span>
              </div>
              <div className={n("duplicate") ? "bad" : ""}>
                <b>{n("duplicate")}</b>
                <span>Twice</span>
              </div>
              <div className={n("invigilator") ? "bad" : ""}>
                <b>{n("invigilator")}</b>
                <span>Invigilator</span>
              </div>
            </div>
            {issues.length === 0 && <p className="okmsg">No clashes.</p>}
            {[...errors, ...warnings].slice(0, 60).map((i, k) => (
              <div key={k} className={`issue${i.severity === "warning" ? " warn" : ""}`}>
                <div className="t">{i.severity === "error" ? "Clash" : "Same day"}</div>
                {i.message}
                <br />
                <button type="button" className="linkbtn" onClick={() => setFlash(i.paperIds)}>
                  Show on timetable
                </button>
              </div>
            ))}
            {t.programme === "ug" && (
              <>
                <h2 style={{ marginTop: 16 }}>Not yet scheduled ({missing.length})</h2>
                {missing.length === 0 ? (
                  <p className="okmsg">Every course on the lecture timetable has an examination.</p>
                ) : (
                  <>
                    <p className="hint">Courses on this semester&apos;s lecture timetable with no examination yet.{canAdd ? " Click one to schedule it." : ""}</p>
                    <div className="misslist">
                      {missing.map((c) =>
                        canAdd && canEdit({ kind: "paper", label: c }) ? (
                          <button key={c} type="button" className="chip-btn" onClick={() => setDrawer({ mode: "new", paper: blank(t.dates[0], 0, c) })}>
                            {c}
                          </button>
                        ) : (
                          <span key={c} className="chip-btn ro">
                            {c}
                          </span>
                        ),
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </aside>
        </div>
      )}
      <p className="hint">
        {canAdd
          ? "Click inside a session to add a paper; click a paper to edit it; drag a paper to another session to move it (on a phone, press and hold first)."
          : "You have view-only access to this timetable. Click a paper to see its details."}
        {actor.role === "dept_officer" && t.dept === null ? ` On the Faculty timetable you can add and change ${actor.dept} papers only.` : ""}
      </p>

      {drawer && <ExamPaperDrawer state={drawer} data={data} papers={papers} actor={actor} canEdit={canEdit} onClose={() => setDrawer(null)} />}
    </>
  );
}

function XCell(props: { date: string; session: number; number: number; onAdd: (() => void) | null; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `x:${props.date}:${props.session}`, data: { date: props.date, session: props.session } });
  return (
    <div
      ref={setNodeRef}
      className={`xcell${props.onAdd ? " can-add" : ""}${isOver ? " drop" : ""}`}
      onClick={(e) => {
        if (props.onAdd && e.target === e.currentTarget) props.onAdd();
      }}
    >
      <span className="sn" onClick={props.onAdd ?? undefined}>
        SESSION {props.number}
      </span>
      {props.children}
      {props.onAdd && (
        <button type="button" className="xadd" onClick={props.onAdd} aria-label={`Add a paper to session ${props.number}`}>
          +
        </button>
      )}
    </div>
  );
}

function Chip(props: { paper: ExamPaperDTO; editable: boolean; issues?: ExamIssue[]; dim: boolean; flash: boolean; dragging: boolean; lecturers: string[]; onOpen: () => void }) {
  const { paper: p, editable, issues, dim, flash, dragging, lecturers, onOpen } = props;
  const { setNodeRef, attributes, listeners } = useDraggable({ id: p.id, disabled: !editable });
  const err = issues?.some((i) => i.severity === "error");
  const warn = !err && issues?.length;
  const cat = p.kind === "block" ? "gen" : categoryOf({ kind: "course", label: p.label });
  const title = [paperText(p), lecturers.length ? `Lecturer: ${lecturers.join(", ")}` : "", p.note, ...(issues ?? []).map((i) => `⚠ ${i.message}`)].filter(Boolean).join("\n");
  return (
    <div
      ref={setNodeRef}
      {...(editable ? { ...attributes, ...listeners } : { role: "button", tabIndex: 0 })}
      data-paper={p.id}
      title={title}
      className={["chip", cat, p.kind === "block" ? "block" : "", editable ? "draggable" : "", err ? "clash" : "", warn ? "warnc" : "", dim ? "dim" : "", flash ? "flash" : "", dragging ? "dragging" : ""].filter(Boolean).join(" ")}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      <b>{p.label}</b>
      {p.kind === "paper" && (p.year || p.venues.length > 0) && <span className="v">({[p.year, ...p.venues].filter(Boolean).join(", ")})</span>}
      {p.note && <span className="v note">{p.note}</span>}
    </div>
  );
}
