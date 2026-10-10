"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DAYS, DEPARTMENTS, KIND_LABELS, SLOTS, codesOf, fitsInBlock, levelName, type Kind } from "@/lib/timetable";
import { courseInfo, findClashes, type CourseInfo } from "@/lib/clash";
import type { BookingDTO, VenueDTO } from "@/lib/types";
import { deleteBooking, saveBooking } from "@/app/actions";
import { useToast } from "./Toast";
import { outsideDeptMessage, type Actor } from "@/lib/permissions";

export type DrawerState = { mode: "new" | "edit"; booking: BookingDTO };

interface Props {
  state: DrawerState;
  semesterId: number;
  venues: VenueDTO[];
  bookings: BookingDTO[];
  ctx: { courses: Map<string, CourseInfo>; lecturerName: (id: string) => string | undefined };
  actor: Actor;
  canEdit: (b: { kind: Kind; label: string }) => boolean;
  onClose: () => void;
}

/** Side panel for adding or editing one booking, with a live clash preview. */
export function BookingDrawer({ state, semesterId, venues, bookings, ctx, actor, canEdit, onClose }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<BookingDTO>(state.booking);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(state.booking);
    setConfirmDelete(false);
    firstField.current?.focus();
  }, [state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof BookingDTO>(k: K, v: BookingDTO[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const fits = fitsInBlock(draft.start, draft.span);
  // Can this person change the booking as it was, and save it as it now reads?
  const mayEditOriginal = state.mode === "new" || canEdit(state.booking);
  const mayKeepDraft = !draft.label.trim() || canEdit(draft);
  const readOnly = !mayEditOriginal;
  const codes = codesOf(draft.label);

  const preview = useMemo(() => {
    const me = { ...draft, id: "__draft" };
    return findClashes([...bookings.filter((b) => b.id !== draft.id), me], ctx).filter((c) => c.bookingIds.includes("__draft"));
  }, [draft, bookings, ctx]);

  const lecturers = [...new Set(codes.flatMap((c) => courseInfo(c, ctx).lecturerIds))]
    .map((id) => ctx.lecturerName(id))
    .filter(Boolean);

  function save() {
    startTransition(async () => {
      const r = await saveBooking({ ...draft, id: state.mode === "edit" ? draft.id : null, semesterId });
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
      const r = await deleteBooking(draft.id);
      if (r.ok) {
        toast(r.message ?? "Deleted.");
        router.refresh();
        onClose();
      } else toast(r.error, true);
    });
  }

  return (
    <div className="drawer" role="dialog" aria-modal="false" aria-labelledby="drawer-title">
      <header>
        <h3 id="drawer-title">{state.mode === "new" ? "New booking" : readOnly ? "Booking details" : "Edit booking"}</h3>
        <button type="button" className="xbtn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="body">
        {readOnly && <p className="readonly-note">{outsideDeptMessage(actor)}</p>}
        {!readOnly && !mayKeepDraft && <p className="issue">{outsideDeptMessage(actor)}</p>}
        <fieldset disabled={readOnly} className="plain">
        <label className="fld">
          <span>Course code(s)</span>
          <input
            ref={firstField}
            id="booking-label"
            value={draft.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="CSC308 or CSC308/CSC411"
          />
        </label>
        <p className="hint">
          Use a slash for courses taught together. For other periods, pick a type below and type a label such as
          “Mathematics Tutorial”.
        </p>
        <label className="fld">
          <span>Type</span>
          <select id="booking-kind" value={draft.kind} onChange={(e) => set("kind", e.target.value as Kind)}>
            {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <div className="row2">
          <label className="fld">
            <span>Venue</span>
            <select id="booking-venue" value={draft.venueCode} onChange={(e) => set("venueCode", e.target.value)}>
              {venues.map((v) => (
                <option key={v.code} value={v.code}>
                  {v.code} ({v.seats})
                </option>
              ))}
            </select>
          </label>
          <label className="fld">
            <span>Day</span>
            <select id="booking-day" value={draft.day} onChange={(e) => set("day", Number(e.target.value))}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row2">
          <label className="fld">
            <span>Starts</span>
            <select id="booking-start" value={draft.start} onChange={(e) => set("start", Number(e.target.value))}>
              {SLOTS.map((s, i) => (
                <option key={s} value={i}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="fld">
            <span>Hours</span>
            <select id="booking-span" value={draft.span} onChange={(e) => set("span", Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="fld">
          <span>Note</span>
          <input id="booking-note" value={draft.note} onChange={(e) => set("note", e.target.value)} placeholder="Optional" />
        </label>

        <div className="hint">
          {!fits && (
            <p style={{ color: "var(--bad)", fontWeight: 600, margin: "0 0 4px" }}>
              This runs past {draft.start < 6 ? "the 2:00 break" : "6:30 p.m."}. Shorten it or start earlier.
            </p>
          )}
          {draft.kind === "course" &&
            codes.map((c) => {
              const info = courseInfo(c, ctx);
              return (
                <div key={c}>
                  {c}: {levelName(info.level)} · {DEPARTMENTS[info.dept] ?? info.dept}
                  {info.isCommon ? " · common" : ""}
                </div>
              );
            })}
          {draft.kind === "course" && codes.length > 0 && (
            <div>{lecturers.length ? `Lecturer: ${lecturers.join(", ")}` : "No lecturer assigned yet."}</div>
          )}
        </div>

        </fieldset>
        {preview.map((c, i) => (
          <div key={i} className={`issue${c.severity === "warning" ? " warn" : ""}`}>
            {c.message}
          </div>
        ))}
      </div>
      <div className="actions">
        {!readOnly && (
          <button type="button" className="btn primary" onClick={save} disabled={pending || !fits || !draft.label.trim() || !mayKeepDraft}>
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
