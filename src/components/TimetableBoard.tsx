"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { DAYS, DEPARTMENTS, SLOTS, categoryOf, codesOf, fitsInBlock } from "@/lib/timetable";
import { clashesByBooking, findClashes, type Clash, type CourseInfo } from "@/lib/clash";
import type { BookingDTO, TimetableData } from "@/lib/types";
import { moveBooking } from "@/app/actions";
import { useToast } from "./Toast";
import { BookingDrawer, type DrawerState } from "./BookingDrawer";
import { ClashList } from "./ClashList";

type Focus = { type: "all" | "level" | "dept" | "lecturer"; value: string };

/** Grid column (1-based) for a slot: venue = 1, day = 2, morning slots 3–8, break 9, afternoon 10–13. */
const colOf = (slot: number) => (slot < 6 ? 3 + slot : 4 + slot);

export function TimetableBoard({ data, showId }: { data: TimetableData; showId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  // Local copy so drags feel instant; replaced whenever the server sends fresh data.
  const [bookings, setBookings] = useState<BookingDTO[]>(data.bookings);
  useEffect(() => setBookings(data.bookings), [data.bookings]);

  const [focus, setFocus] = useState<Focus>({ type: "all", value: "" });
  const [showShared, setShowShared] = useState(true);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(showId ?? null);

  const ctx = useMemo(() => {
    const courses = new Map<string, CourseInfo>(
      data.courses.map((c) => [c.code, { code: c.code, level: c.level, dept: c.dept, isCommon: c.isCommon, lecturerIds: c.lecturerIds }]),
    );
    const names = new Map(data.lecturers.map((l) => [l.id, l.name]));
    return { courses, lecturerName: (id: string) => names.get(id) };
  }, [data.courses, data.lecturers]);

  const clashes = useMemo(() => findClashes(bookings, ctx), [bookings, ctx]);
  const byBooking = useMemo(() => clashesByBooking(clashes), [clashes]);

  // Scroll to and flash a booking linked from the Clashes page (/?show=<id>).
  useEffect(() => {
    if (!flashId) return;
    const el = document.querySelector<HTMLElement>(`[data-booking="${CSS.escape(flashId)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    const t = setTimeout(() => setFlashId(null), 2600);
    return () => clearTimeout(t);
  }, [flashId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), // small move = click, bigger = drag
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }), // press-and-hold on phones
  );

  const matches = (b: BookingDTO) => {
    if (focus.type === "all" || !focus.value) return true;
    const cs = codesOf(b.label).map((c) => ctx.courses.get(c));
    if (focus.type === "level") return cs.some((c) => String(c?.level) === focus.value);
    if (focus.type === "dept") return cs.some((c) => c?.dept === focus.value);
    return cs.some((c) => c?.lecturerIds.includes(focus.value));
  };

  const focusOptions: [string, string][] =
    focus.type === "level"
      ? [["1", "100 Level"], ["2", "200 Level"], ["3", "300 Level"], ["4", "400 Level"]]
      : focus.type === "dept"
        ? [...new Set(data.courses.map((c) => c.dept))].sort().map((d) => [d, DEPARTMENTS[d] ?? d])
        : focus.type === "lecturer"
          ? data.lecturers.map((l) => [l.id, l.name])
          : [];

  function onDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const b = bookings.find((x) => x.id === e.active.id);
    const over = e.over?.data.current as { venue: string; day: number; start: number } | undefined;
    if (!b || !over) return;
    if (over.venue === b.venueCode && over.day === b.day && over.start === b.start) return;
    if (!fitsInBlock(over.start, b.span)) {
      toast(`${b.label} is ${b.span} h long and would run past ${over.start < 6 ? "the 2:00 break" : "6:30 p.m."}.`, true);
      return;
    }
    const before = bookings;
    setBookings((all) => all.map((x) => (x.id === b.id ? { ...x, venueCode: over.venue, day: over.day, start: over.start } : x)));
    startTransition(async () => {
      const r = await moveBooking(b.id, over.venue, over.day, over.start);
      if (r.ok) {
        toast(`${b.label} moved to ${over.venue}, ${DAYS[over.day]} ${SLOTS[over.start]}.`);
        router.refresh();
      } else {
        setBookings(before);
        toast(r.error, true);
      }
    });
  }

  const dragged = dragId ? bookings.find((b) => b.id === dragId) : null;
  const visible = bookings.filter((b) => showShared || b.kind !== "shared");

  if (!data.semester) {
    return (
      <div className="card empty">
        No semester has been set up yet. Run <code>npm run db:setup</code> to load the 2026/2027 timetable.
      </div>
    );
  }

  return (
    <>
      <div className="bar">
        <label>
          Focus
          <select
            value={focus.type}
            onChange={(e) => setFocus({ type: e.target.value as Focus["type"], value: "" })}
            aria-label="Focus on"
          >
            <option value="all">Whole faculty</option>
            <option value="level">Level</option>
            <option value="dept">Department</option>
            <option value="lecturer">Lecturer</option>
          </select>
        </label>
        {focus.type !== "all" && (
          <label>
            <select value={focus.value} onChange={(e) => setFocus({ ...focus, value: e.target.value })} aria-label="Focus value">
              <option value="">{focusOptions.length ? "Choose…" : focus.type === "lecturer" ? "No lecturers yet" : "—"}</option>
              {focusOptions.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="toggle">
          <input type="checkbox" checked={showShared} onChange={(e) => setShowShared(e.target.checked)} /> Show other
          faculties&apos; bookings
        </label>
        <div className="exports">
          <a className="btn" href="/export/docx">
            Download Word
          </a>
          <a className="btn" href="/print">
            Print / PDF
          </a>
        </div>
        <div className="legend">
          <span><i style={{ background: "var(--comp)", borderColor: "var(--comp-bar)" }} />Computing</span>
          <span><i style={{ background: "var(--sci)", borderColor: "var(--sci-bar)" }} />Maths &amp; Science</span>
          <span><i style={{ background: "var(--gen)", borderColor: "var(--gen-bar)" }} />GST / ENT / CED</span>
          <span><i style={{ background: "var(--act)", borderColor: "var(--act-bar)" }} />Tutorial / Practical</span>
          <span>
            <i style={{ background: "repeating-linear-gradient(135deg,var(--shared) 0 4px,var(--hatch) 4px 8px)", borderColor: "var(--line)" }} />
            Other faculty
          </span>
        </div>
      </div>

      <div className="layout">
        <div className="scroller">
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
            <Grid
              data={data}
              bookings={visible}
              byBooking={byBooking}
              matches={matches}
              ctx={ctx}
              flashId={flashId}
              dragId={dragId}
              onOpen={(b) => setDrawer({ mode: "edit", booking: b })}
              onAdd={(venue, day, start) =>
                setDrawer({ mode: "new", booking: { id: "", venueCode: venue, day, start, span: 1, label: "", kind: "course", note: "" } })
              }
            />
            <DragOverlay dropAnimation={null}>
              {dragged ? <div className={`blk ${categoryOf(dragged)} drag-ghost`}>{dragged.label}</div> : null}
            </DragOverlay>
          </DndContext>
        </div>
        <aside className="rail">
          <h2>Clash check</h2>
          <Summary clashes={clashes} />
          <ClashList clashes={clashes} limit={40} onShow={(id) => setFlashId(id)} />
        </aside>
      </div>
      <p className="hint">
        Drag a course onto an empty slot to move it (on a phone, press and hold first). Click a course to edit it, or click an
        empty slot to add a booking.
      </p>

      {drawer && (
        <BookingDrawer
          state={drawer}
          semesterId={data.semester.id}
          venues={data.venues}
          bookings={bookings}
          ctx={ctx}
          onClose={() => setDrawer(null)}
        />
      )}
    </>
  );
}

function Summary({ clashes }: { clashes: Clash[] }) {
  const n = (t: Clash["type"]) => clashes.filter((c) => c.type === t).length;
  const items: [Clash["type"], string][] = [["students", "Student"], ["venue", "Venue"], ["lecturer", "Lecturer"]];
  return (
    <div className="sum">
      {items.map(([t, label]) => (
        <div key={t} className={n(t) ? "bad" : ""}>
          <b>{n(t)}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

/** Places overlapping bookings in a row on separate lanes so none hide another. */
function assignLanes(rowBookings: BookingDTO[]) {
  const sorted = [...rowBookings].sort((a, b) => a.start - b.start || b.span - a.span);
  const ends: number[] = [];
  const lane = new Map<string, number>();
  for (const b of sorted) {
    let l = ends.findIndex((e) => e <= b.start);
    if (l < 0) {
      l = ends.length;
      ends.push(0);
    }
    ends[l] = b.start + b.span;
    lane.set(b.id, l);
  }
  return { lane, count: Math.max(1, ends.length) };
}

interface GridProps {
  data: TimetableData;
  bookings: BookingDTO[];
  byBooking: Map<string, Clash[]>;
  matches: (b: BookingDTO) => boolean;
  ctx: { courses: Map<string, CourseInfo>; lecturerName: (id: string) => string | undefined };
  flashId: string | null;
  dragId: string | null;
  onOpen: (b: BookingDTO) => void;
  onAdd: (venue: string, day: number, start: number) => void;
}

function Grid({ data, bookings, byBooking, matches, ctx, flashId, dragId, onOpen, onAdd }: GridProps) {
  const rows: string[] = ["auto", "auto"];
  const parts: React.ReactNode[] = [];
  let r = 3;

  for (const v of data.venues) {
    const r0 = r;
    for (let d = 0; d < 5; d++) {
      const rowBookings = bookings.filter((b) => b.venueCode === v.code && b.day === d);
      const { lane, count } = assignLanes(rowBookings);
      rows.push(`minmax(${count * 34}px, auto)`);
      const first = d === 0 ? " first" : "";
      parts.push(
        <div key={`d-${v.code}-${d}`} className={`day${first}`} style={{ gridRow: r, gridColumn: 2 }}>
          {DAYS[d]}
        </div>,
      );
      for (let s = 0; s < 10; s++) {
        parts.push(<Cell key={`c-${v.code}-${d}-${s}`} venue={v.code} day={d} start={s} row={r} first={!!first} onAdd={onAdd} />);
      }
      for (const b of rowBookings) {
        const lecturers = [...new Set(codesOf(b.label).flatMap((c) => ctx.courses.get(c)?.lecturerIds ?? []))]
          .map((id) => ctx.lecturerName(id))
          .filter(Boolean) as string[];
        parts.push(
          <Block
            key={b.id}
            booking={b}
            row={r}
            lane={lane.get(b.id) ?? 0}
            clashes={byBooking.get(b.id)}
            dim={!matches(b)}
            flash={flashId === b.id}
            dragging={dragId === b.id}
            lecturers={lecturers}
            onOpen={onOpen}
          />,
        );
      }
      r++;
    }
    parts.push(
      <div key={`v-${v.code}`} className="venue" style={{ gridRow: `${r0} / ${r}`, gridColumn: 1 }}>
        <b>{v.code}</b>
        <small>{v.seats} seats</small>
      </div>,
      <div key={`brk-${v.code}`} className="brkcol first" style={{ gridRow: `${r0} / ${r}`, gridColumn: 9 }}>
        BREAK
      </div>,
    );
  }

  return (
    <div className="grid" style={{ gridTemplateRows: rows.join(" ") }}>
      <div className="h" style={{ gridRow: "1 / 3", gridColumn: 1 }}>VENUE</div>
      <div className="h" style={{ gridRow: "1 / 3", gridColumn: 2 }}>DAY</div>
      <div className="h" style={{ gridRow: 1, gridColumn: "3 / 9" }}>MORNING · a.m.</div>
      <div className="h brk" style={{ gridRow: "1 / 3", gridColumn: 9 }}>2–2:30</div>
      <div className="h" style={{ gridRow: 1, gridColumn: "10 / 14" }}>AFTERNOON · p.m.</div>
      {SLOTS.map((t, i) => (
        <div key={t} className="h sub" style={{ gridRow: 2, gridColumn: colOf(i) }}>
          {t}
        </div>
      ))}
      {parts}
    </div>
  );
}

function Cell(props: { venue: string; day: number; start: number; row: number; first: boolean; onAdd: GridProps["onAdd"] }) {
  const { venue, day, start, row, first, onAdd } = props;
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${venue}:${day}:${start}`, data: { venue, day, start } });
  return (
    <div
      ref={setNodeRef}
      className={`cell can-add${first ? " first" : ""}${isOver ? " drop" : ""}`}
      style={{ gridRow: row, gridColumn: colOf(start) }}
      onClick={() => onAdd(venue, day, start)}
      aria-label={`Add a booking in ${venue}, ${DAYS[day]} ${SLOTS[start]}`}
    />
  );
}

function Block(props: {
  booking: BookingDTO;
  row: number;
  lane: number;
  clashes?: Clash[];
  dim: boolean;
  flash: boolean;
  dragging: boolean;
  lecturers: string[];
  onOpen: (b: BookingDTO) => void;
}) {
  const { booking: b, row, lane, clashes, dim, flash, dragging, lecturers, onOpen } = props;
  const { setNodeRef, attributes, listeners } = useDraggable({ id: b.id });
  const label = b.kind === "pt" ? "PART-TIME (PT)" : b.label;
  const hasError = clashes?.some((c) => c.severity === "error");
  const title = [
    `${b.label} · ${b.venueCode} · ${DAYS[b.day]} ${SLOTS[b.start]}${b.span > 1 ? ` (${b.span} h)` : ""}`,
    lecturers.length ? `Lecturer: ${lecturers.join(", ")}` : "",
    b.note,
    ...(clashes ?? []).map((c) => `⚠ ${c.message}`),
  ]
    .filter(Boolean)
    .join("\n");
  const cls = [
    "blk",
    categoryOf(b),
    "draggable",
    b.span === 1 && label.length > 8 ? "tight" : "",
    hasError ? "clash" : "",
    dim ? "dim" : "",
    flash ? "flash" : "",
    dragging ? "dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-booking={b.id}
      className={cls}
      title={title}
      style={{ gridRow: row, gridColumn: `${colOf(b.start)} / span ${b.span}`, ["--lane" as string]: lane }}
      onClick={() => onOpen(b)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(b);
      }}
    >
      {label}
      {lecturers.length > 0 && b.span > 1 && (
        <span className="lec">
          · {lecturers[0]}
          {lecturers.length > 1 ? ` +${lecturers.length - 1}` : ""}
        </span>
      )}
    </div>
  );
}
