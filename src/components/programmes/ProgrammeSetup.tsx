"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProgrammeTimetable, setProgrammePublished, updateProgrammeSetup } from "@/app/programme-actions";
import { WEEKDAYS, type CalendarRow, type Period, type VenueKeyItem } from "@/lib/programme";
import type { ProgrammeTimetableDTO } from "@/lib/types";
import { useToast } from "../Toast";

/** Generic editable list: one row per item, with add / remove / move. */
function ListEdit<T>(props: { items: T[]; onChange: (items: T[]) => void; blank: T; row: (item: T, set: (v: T) => void, i: number) => React.ReactNode; addLabel: string; max?: number; min?: number }) {
  const { items, onChange, blank, row, addLabel, max = 30, min = 0 } = props;
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="list-edit">
      {items.map((it, i) => (
        <div key={i} className="li li-wide">
          <div className="li-fields">{row(it, (v) => onChange(items.map((x, k) => (k === i ? v : x))), i)}</div>
          <div className="nowrap">
            <button type="button" className="btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>{" "}
            <button type="button" className="btn" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>{" "}
            <button type="button" className="btn" disabled={items.length <= min} onClick={() => onChange(items.filter((_, k) => k !== i))}>
              Remove
            </button>
          </div>
        </div>
      ))}
      {items.length < max && (
        <div>
          <button type="button" className="btn" onClick={() => onChange([...items, blank])}>
            {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export function ProgrammeSetup({ t }: { t: ProgrammeTimetableDTO }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(t.title);
  const [days, setDays] = useState(t.days);
  const [groups, setGroups] = useState(t.groups.length ? t.groups : [""]);
  const [periods, setPeriods] = useState<Period[]>(t.periods);
  const [venueKey, setVenueKey] = useState<VenueKeyItem[]>(t.venueKey);
  const [calendar, setCalendar] = useState<CalendarRow[]>(t.calendar);
  const [notes, setNotes] = useState(t.notes);
  const [signatoryName, setSignatoryName] = useState(t.signatoryName);
  const [signatoryRole, setSignatoryRole] = useState(t.signatoryRole);
  const [published, setPublishedState] = useState(t.isPublished);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void, undo?: () => void) {
    startTransition(async () => {
      const r = await fn();
      toast((r.ok ? r.message : r.error) ?? "Saved.", !r.ok);
      if (r.ok) {
        if (after) after();
        else router.refresh();
      }
      else undo?.();
    });
  }

  return (
    <>
      <section className="card">
        <h2>Publishing</h2>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => {
              const on = e.target.checked;
              setPublishedState(on);
              run(() => setProgrammePublished(t.id, on), undefined, () => setPublishedState(!on));
            }}
          />
          Show this timetable on the public page
        </label>
      </section>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => updateProgrammeSetup(t.id, { title, days, groups, periods, venueKey, calendar, notes, signatoryName, signatoryRole }));
        }}
      >
        <h2>Set-up</h2>
        <label className="fld">
          <span>Title</span>
          <input id="ps-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <h3 className="sub">Lecture days</h3>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {WEEKDAYS.map((d, i) => (
            <label key={d} className="toggle-row">
              <input type="checkbox" checked={days.includes(i)} onChange={(e) => setDays((x) => (e.target.checked ? [...x, i].sort() : x.filter((y) => y !== i)))} />
              {d}
            </label>
          ))}
        </div>

        <h3 className="sub">Rows for each day</h3>
        <p className="hint">e.g. YEAR 1 … YEAR 6 for part-time. For a single class (M.Sc.), keep one row and leave its name empty.</p>
        <ListEdit items={groups} onChange={setGroups} blank="" min={1} max={12} addLabel="Add a row" row={(g, set, i) => <input aria-label={`Row ${i + 1}`} value={g} onChange={(e) => set(e.target.value)} placeholder="(no name)" />} />

        <h3 className="sub">Periods</h3>
        <ListEdit
          items={periods}
          onChange={setPeriods}
          blank={{ label: "" }}
          min={1}
          max={14}
          addLabel="Add a period"
          row={(p, set, i) => (
            <>
              <input aria-label={`Period ${i + 1}`} value={p.label} onChange={(e) => set({ ...p, label: e.target.value })} placeholder="8:00A.M. – 9:00A.M." />
              <label className="toggle-row">
                <input type="checkbox" checked={!!p.isBreak} onChange={(e) => set({ ...p, isBreak: e.target.checked })} /> Break
              </label>
            </>
          )}
        />

        <h3 className="sub">Key to venue allocation</h3>
        <ListEdit
          items={venueKey}
          onChange={setVenueKey}
          blank={{ code: "", name: "" }}
          addLabel="Add a venue"
          row={(v, set, i) => (
            <>
              <input aria-label={`Venue ${i + 1} letter`} className="short-in" value={v.code} onChange={(e) => set({ ...v, code: e.target.value.toUpperCase() })} placeholder="A" />
              <input aria-label={`Venue ${i + 1} name`} value={v.name} onChange={(e) => set({ ...v, name: e.target.value })} placeholder="1000 LT" />
            </>
          )}
        />

        <h3 className="sub">Calendar</h3>
        <ListEdit
          items={calendar}
          onChange={setCalendar}
          blank={{ weeks: "", dates: "", activity: "" }}
          addLabel="Add a calendar line"
          row={(c, set, i) => (
            <>
              <input aria-label={`Calendar ${i + 1} weeks`} className="short-in" value={c.weeks} onChange={(e) => set({ ...c, weeks: e.target.value })} placeholder="1 – 11" />
              <input aria-label={`Calendar ${i + 1} dates`} value={c.dates} onChange={(e) => set({ ...c, dates: e.target.value })} placeholder="23/01/2026 – 13/03/2026" />
              <input aria-label={`Calendar ${i + 1} activity`} value={c.activity} onChange={(e) => set({ ...c, activity: e.target.value })} placeholder="LECTURES IN PROGRESS" />
            </>
          )}
        />

        <h3 className="sub">Notes</h3>
        <ListEdit items={notes} onChange={setNotes} blank="" addLabel="Add a note" row={(n, set, i) => <textarea aria-label={`Note ${i + 1}`} rows={2} value={n} onChange={(e) => set(e.target.value)} />} />

        <h3 className="sub">Signed by</h3>
        <div className="row2">
          <label className="fld">
            <span>Name</span>
            <input id="ps-signatory" value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} placeholder="e.g. Mr. I. E. Obayagbona" />
          </label>
          <label className="fld">
            <span>Position</span>
            <input value={signatoryRole} onChange={(e) => setSignatoryRole(e.target.value)} placeholder="Departmental Time-Table Officer" />
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
        <p className="hint">Removes the timetable, its classes and course list. This cannot be undone.</p>
        <button
          type="button"
          className={`btn danger${confirmDelete ? " sure" : ""}`}
          disabled={pending}
          onClick={() => (confirmDelete ? run(() => deleteProgrammeTimetable(t.id), () => router.push("/programmes")) : setConfirmDelete(true))}
        >
          {confirmDelete ? "Confirm: delete the timetable" : "Delete timetable"}
        </button>
      </section>
    </>
  );
}
