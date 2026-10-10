"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { codesOf } from "@/lib/timetable";
import { WEEKDAYS, fits, programmeIssues, timeRange, type PSlot } from "@/lib/programme";
import type { ProgrammeBoardData } from "@/lib/types";
import { deleteProgrammeSlot, saveProgrammeSlot } from "@/app/programme-actions";
import { useToast } from "../Toast";
import { useProgrammeCtx } from "./ProgrammeBoard";

const QUICK = ["FREE", "PRACTICAL", "TUTORIALS", "SEMINAR", "LECTURE FREE"];

/** Add or edit one class (or FREE / PRACTICAL / TUTORIALS …) on a part-time or postgraduate timetable. */
export function SlotDrawer({ state, data, slots, onClose }: { state: { mode: "new" | "edit"; slot: PSlot }; data: ProgrammeBoardData; slots: PSlot[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const ctx = useProgrammeCtx(data);
  const t = data.timetable;
  const [d, setD] = useState<PSlot>(state.slot);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setD(state.slot);
    setConfirmDelete(false);
    first.current?.focus();
  }, [state]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof PSlot>(k: K, v: PSlot[K]) => setD((x) => ({ ...x, [k]: v }));
  const ok = fits(t.periods, d.start, d.span);
  const label = d.kind === "course" ? d.label.toUpperCase().replace(/\s+/g, "") : d.label.trim();
  const preview = useMemo(() => {
    if (!label) return [];
    return programmeIssues([...slots.filter((s) => s.id !== d.id), { ...d, label, venue: d.venue.toUpperCase(), id: "__draft" }], ctx).filter((i) => i.slotIds.includes("__draft"));
  }, [d, label, slots, ctx]);
  const alloc = new Map(data.courses.map((c) => [c.code, c]));
  const codes = d.kind === "course" ? codesOf(label) : [];

  function save() {
    startTransition(async () => {
      const r = await saveProgrammeSlot({ ...d, id: state.mode === "edit" ? d.id : undefined, timetableId: t.id });
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
      const r = await deleteProgrammeSlot(d.id);
      if (r.ok) {
        toast(r.message ?? "Deleted.");
        router.refresh();
        onClose();
      } else toast(r.error, true);
    });
  }

  return (
    <div className="drawer" role="dialog" aria-modal="false" aria-labelledby="slot-title">
      <header>
        <h3 id="slot-title">{state.mode === "new" ? "Add a class" : "Edit class"}</h3>
        <button type="button" className="xbtn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="body">
        <div className="seg" role="tablist" aria-label="Type">
          <button type="button" role="tab" aria-selected={d.kind === "course"} onClick={() => set("kind", "course")}>
            Course
          </button>
          <button type="button" role="tab" aria-selected={d.kind === "activity"} onClick={() => set("kind", "activity")}>
            Other (FREE, PRACTICAL…)
          </button>
        </div>
        <label className="fld">
          <span>{d.kind === "course" ? "Course code(s)" : "What happens"}</span>
          <input ref={first} id="slot-label" value={d.label} onChange={(e) => set("label", e.target.value)} placeholder={d.kind === "course" ? "CSC111 or COS101/CSC110" : "PRACTICAL"} list={d.kind === "course" ? "slot-codes" : "slot-quick"} />
          <datalist id="slot-codes">
            {data.courses.map((c) => (
              <option key={c.id} value={c.code}>
                {c.title}
              </option>
            ))}
          </datalist>
          <datalist id="slot-quick">
            {QUICK.map((q) => (
              <option key={q} value={q} />
            ))}
          </datalist>
        </label>
        <div className="row2">
          <label className="fld">
            <span>Day</span>
            <select id="slot-day" value={d.day} onChange={(e) => set("day", Number(e.target.value))}>
              {t.days.map((x) => (
                <option key={x} value={x}>
                  {WEEKDAYS[x]}
                </option>
              ))}
            </select>
          </label>
          {ctx.groups.length > 1 && (
            <label className="fld">
              <span>Row</span>
              <select id="slot-group" value={d.group} onChange={(e) => set("group", Number(e.target.value))}>
                {ctx.groups.map((g, i) => (
                  <option key={i} value={i}>
                    {g || `Row ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="row2">
          <label className="fld">
            <span>Starts</span>
            <select id="slot-start" value={d.start} onChange={(e) => set("start", Number(e.target.value))}>
              {t.periods.map((p, i) =>
                p.isBreak ? null : (
                  <option key={i} value={i}>
                    {p.label}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="fld">
            <span>Periods</span>
            <select id="slot-span" value={d.span} onChange={(e) => set("span", Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="fld">
          <span>Venue</span>
          <select id="slot-venue" value={d.venue} onChange={(e) => set("venue", e.target.value)}>
            <option value="">— None —</option>
            {t.venueKey.map((v) => (
              <option key={v.code} value={v.code}>
                {v.code} — {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          <span>Note</span>
          <input id="slot-note" value={d.note} onChange={(e) => set("note", e.target.value)} placeholder="Optional" />
        </label>
        <div className="hint">
          {ok ? timeRange(t.periods, d.start, d.span) : <b style={{ color: "var(--bad)" }}>This runs into a break or past the last period.</b>}
          {codes.map((c) => {
            const a = alloc.get(c);
            const lec = ctx.lecturersOf(c).map(ctx.short);
            return (
              <div key={c}>
                {c}
                {a?.title ? `: ${a.title}` : ""}
                {lec.length ? ` · ${lec.join(", ")}` : " · no lecturer recorded"}
              </div>
            );
          })}
        </div>
        {preview.map((i, k) => (
          <div key={k} className={`issue${i.severity === "warning" ? " warn" : ""}`}>
            {i.message}
          </div>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="btn primary" onClick={save} disabled={pending || !ok || !label}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        {state.mode === "edit" && (
          <button type="button" className={`btn danger${confirmDelete ? " sure" : ""}`} onClick={remove} disabled={pending}>
            {confirmDelete ? "Confirm delete" : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}
