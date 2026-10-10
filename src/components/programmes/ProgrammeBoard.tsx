"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { categoryOf } from "@/lib/timetable";
import { WEEKDAYS, fits, groupRows, lecturersLookup, programmeIssues, semesterNumber, slotText, unscheduledCourses, type PIssue, type PSlot } from "@/lib/programme";
import { printName } from "@/lib/invigilation";
import type { ProgrammeBoardData } from "@/lib/types";
import { moveProgrammeSlot } from "@/app/programme-actions";
import { useToast } from "../Toast";
import { SlotDrawer } from "./SlotDrawer";

/** The rule context shared by the board and the drawer. */
export function useProgrammeCtx(data: ProgrammeBoardData) {
  return useMemo(() => {
    const t = data.timetable;
    const person = new Map(data.lecturers.map((l) => [l.id, l]));
    return {
      periods: t.periods,
      groups: groupRows(t.groups),
      venueKey: t.venueKey,
      lecturersOf: lecturersLookup(data.courses, data.courseLecturers),
      name: (id: string) => person.get(id)?.name ?? "Unknown",
      short: (id: string) => (person.has(id) ? printName(person.get(id)!) : "?"),
    };
  }, [data]);
}

function lanes(rowSlots: PSlot[]) {
  const sorted = [...rowSlots].sort((a, b) => a.start - b.start || b.span - a.span);
  const ends: number[] = [];
  const lane = new Map<string, number>();
  for (const s of sorted) {
    let l = ends.findIndex((e) => e <= s.start);
    if (l < 0) {
      l = ends.length;
      ends.push(0);
    }
    ends[l] = s.start + s.span;
    lane.set(s.id, l);
  }
  return { lane, count: Math.max(1, ends.length) };
}

export function ProgrammeBoard({ data, canManage }: { data: ProgrammeBoardData; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const t = data.timetable;
  const ctx = useProgrammeCtx(data);
  const [slots, setSlots] = useState(data.slots);
  useEffect(() => setSlots(data.slots), [data.slots]);
  const [drawer, setDrawer] = useState<{ mode: "new" | "edit"; slot: PSlot } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string[]>([]);

  const issues = useMemo(() => programmeIssues(slots, ctx), [slots, ctx]);
  const issueOf = useMemo(() => {
    const m = new Map<string, PIssue[]>();
    for (const i of issues) for (const id of i.slotIds) m.set(id, [...(m.get(id) ?? []), i]);
    return m;
  }, [issues]);
  const missing = unscheduledCourses(data.courses, slots, semesterNumber(data.semester.name));

  useEffect(() => {
    if (!flash.length) return;
    document.querySelector<HTMLElement>(`[data-slot="${CSS.escape(flash[0])}"]`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    const h = setTimeout(() => setFlash([]), 2600);
    return () => clearTimeout(h);
  }, [flash]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const s = slots.find((x) => x.id === e.active.id);
    const over = e.over?.data.current as { day: number; group: number; start: number } | undefined;
    if (!s || !over || (over.day === s.day && over.group === s.group && over.start === s.start)) return;
    if (!fits(t.periods, over.start, s.span)) {
      toast(`${s.label} would run into a break or past the last period there.`, true);
      return;
    }
    const before = slots;
    setSlots((all) => all.map((x) => (x.id === s.id ? { ...x, ...over } : x)));
    startTransition(async () => {
      const r = await moveProgrammeSlot(s.id, over.day, over.group, over.start);
      if (r.ok) {
        toast(r.message ?? "Moved.");
        router.refresh();
      } else {
        setSlots(before);
        toast(r.error, true);
      }
    });
  }

  const blank = (day: number, group: number, start: number, label = ""): PSlot => ({ id: "", day, group, start, span: 1, label, kind: "course", venue: t.venueKey[group]?.code ?? "", note: "" });
  const P = t.periods.length;
  const cols = `76px ${ctx.groups.length > 1 || ctx.groups[0] ? "78px" : "0px"} ${t.periods.map((p) => (p.isBreak ? "34px" : "minmax(96px, 1fr)")).join(" ")}`;
  const rows: string[] = ["auto"];
  const parts: React.ReactNode[] = [];
  let r = 2;
  for (const day of t.days) {
    const r0 = r;
    ctx.groups.forEach((g, gi) => {
      const rowSlots = slots.filter((s) => s.day === day && s.group === gi);
      const { lane, count } = lanes(rowSlots);
      rows.push(`minmax(${count * 34}px, auto)`);
      const first = gi === 0 ? " first" : "";
      parts.push(
        <div key={`g-${day}-${gi}`} className={`day${first}`} style={{ gridRow: r, gridColumn: 2 }}>
          {g}
        </div>,
      );
      t.periods.forEach((p, pi) => {
        if (!p.isBreak) parts.push(<PCell key={`c-${day}-${gi}-${pi}`} day={day} group={gi} start={pi} row={r} first={!!first} onAdd={canManage ? () => setDrawer({ mode: "new", slot: blank(day, gi, pi) }) : null} label={`${WEEKDAYS[day]} ${g} ${p.label}`} />);
      });
      for (const s of rowSlots)
        parts.push(
          <Block
            key={s.id}
            slot={s}
            row={r}
            lane={lane.get(s.id) ?? 0}
            issues={issueOf.get(s.id)}
            flash={flash.includes(s.id)}
            dragging={dragId === s.id}
            editable={canManage}
            lecturers={s.kind === "course" ? [...new Set(s.label.split("/").flatMap((c) => ctx.lecturersOf(c)))].map(ctx.short) : []}
            onOpen={() => setDrawer({ mode: "edit", slot: s })}
          />,
        );
      r++;
    });
    parts.push(
      <div key={`d-${day}`} className="venue" style={{ gridRow: `${r0} / ${r}`, gridColumn: 1 }}>
        <b className="dayname">{WEEKDAYS[day].toUpperCase()}</b>
      </div>,
    );
    t.periods.forEach((p, pi) => {
      if (p.isBreak)
        parts.push(
          <div key={`b-${day}-${pi}`} className="brkcol first" style={{ gridRow: `${r0} / ${r}`, gridColumn: pi + 3 }}>
            BREAK
          </div>,
        );
    });
  }

  const dragged = dragId ? slots.find((s) => s.id === dragId) : null;
  const errors = issues.filter((i) => i.severity === "error");

  return (
    <>
      <div className="layout">
        <div className="scroller">
          <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
            <div className="grid pgrid" style={{ gridTemplateColumns: cols, gridTemplateRows: rows.join(" "), minWidth: 180 + P * 90 }}>
              <div className="h" style={{ gridRow: 1, gridColumn: 1 }}>
                DAY
              </div>
              <div className="h" style={{ gridRow: 1, gridColumn: 2 }}>
                {ctx.groups.length > 1 || ctx.groups[0] ? "YEAR / TIME" : ""}
              </div>
              {t.periods.map((p, i) => (
                <div key={i} className={`h sub${p.isBreak ? " brk" : ""}`} style={{ gridRow: 1, gridColumn: i + 3 }} title={p.label}>
                  {p.isBreak ? "BREAK" : p.label}
                </div>
              ))}
              {parts}
            </div>
            <DragOverlay dropAnimation={null}>{dragged ? <div className={`blk ${dragged.kind === "course" ? categoryOf({ kind: "course", label: dragged.label }) : "act"} drag-ghost`}>{dragged.label}</div> : null}</DragOverlay>
          </DndContext>
        </div>
        <aside className="rail">
          <h2>Clash check</h2>
          <div className="sum">
            {(["group", "venue", "lecturer"] as const).map((k) => {
              const n = issues.filter((i) => i.type === k).length;
              return (
                <div key={k} className={n ? "bad" : ""}>
                  <b>{n}</b>
                  <span>{k === "group" ? "Class" : k === "venue" ? "Venue" : "Lecturer"}</span>
                </div>
              );
            })}
          </div>
          {issues.length === 0 && <p className="okmsg">No clashes.</p>}
          {[...errors, ...issues.filter((i) => i.severity === "warning")].map((i, k) => (
            <div key={k} className={`issue${i.severity === "warning" ? " warn" : ""}`}>
              {i.message}
              <br />
              <button type="button" className="linkbtn" onClick={() => setFlash(i.slotIds)}>
                Show
              </button>
            </div>
          ))}
          {data.courses.length > 0 && (
            <>
              <h2 style={{ marginTop: 16 }}>Not yet on the timetable ({missing.length})</h2>
              {missing.length === 0 ? (
                <p className="okmsg">Every course on this semester&apos;s list has a lecture.</p>
              ) : (
                <div className="misslist">
                  {missing.map((c) =>
                    canManage ? (
                      <button key={c} type="button" className="chip-btn" onClick={() => setDrawer({ mode: "new", slot: blank(t.days[0], 0, t.periods.findIndex((p) => !p.isBreak), c) })}>
                        {c}
                      </button>
                    ) : (
                      <span key={c} className="chip-btn ro">
                        {c}
                      </span>
                    ),
                  )}
                </div>
              )}
            </>
          )}
          {t.venueKey.length > 0 && (
            <>
              <h2 style={{ marginTop: 16 }}>Venues</h2>
              <ul className="vkey">
                {t.venueKey.map((v) => (
                  <li key={v.code}>
                    <b>{v.code}</b> {v.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
      <p className="hint">
        {canManage
          ? "Click an empty period to add a class (or FREE, PRACTICAL, TUTORIALS…), click a class to edit it, or drag it to another period or row."
          : "View only. The Faculty Time-Table Officer or this department's officer can change this timetable."}
      </p>
      {drawer && <SlotDrawer state={drawer} data={data} slots={slots} onClose={() => setDrawer(null)} />}
    </>
  );
}

function PCell(props: { day: number; group: number; start: number; row: number; first: boolean; onAdd: (() => void) | null; label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `p:${props.day}:${props.group}:${props.start}`, data: { day: props.day, group: props.group, start: props.start } });
  return (
    <div
      ref={setNodeRef}
      className={`cell${props.onAdd ? " can-add" : ""}${props.first ? " first" : ""}${isOver ? " drop" : ""}`}
      style={{ gridRow: props.row, gridColumn: props.start + 3 }}
      onClick={props.onAdd ?? undefined}
      aria-label={props.onAdd ? `Add a class: ${props.label}` : props.label}
    />
  );
}

function Block(props: { slot: PSlot; row: number; lane: number; issues?: PIssue[]; flash: boolean; dragging: boolean; editable: boolean; lecturers: string[]; onOpen: () => void }) {
  const { slot: s, row, lane, issues, flash, dragging, editable, lecturers, onOpen } = props;
  const { setNodeRef, attributes, listeners } = useDraggable({ id: s.id, disabled: !editable });
  const err = issues?.some((i) => i.severity === "error");
  const cat = s.kind === "course" ? categoryOf({ kind: "course", label: s.label }) : "act";
  const text = slotText(s);
  return (
    <div
      ref={setNodeRef}
      {...(editable ? { ...attributes, ...listeners } : { role: "button", tabIndex: 0 })}
      data-slot={s.id}
      className={["blk", cat, editable ? "draggable" : "", s.span === 1 && text.length > 11 ? "tight" : "", err ? "clash" : "", flash ? "flash" : "", dragging ? "dragging" : ""].filter(Boolean).join(" ")}
      style={{ gridRow: row, gridColumn: `${s.start + 3} / span ${s.span}`, ["--lane" as string]: lane }}
      title={[text, lecturers.length ? `Lecturer: ${lecturers.join(", ")}` : "", s.note, ...(issues ?? []).map((i) => `⚠ ${i.message}`)].filter(Boolean).join("\n")}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      {text}
      {lecturers.length > 0 && s.span > 1 && <span className="lec">· {lecturers[0]}</span>}
    </div>
  );
}

