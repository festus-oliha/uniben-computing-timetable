"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSemester, saveVenue, setCurrentSemester, setPublished } from "@/app/settings-actions";
import { COPY_MODES, SEMESTER_NAMES, nextSemester, type CopyMode } from "@/lib/semester";
import type { ActionResult } from "@/lib/types";
import { useToast } from "./Toast";

export interface SemesterRow {
  id: number;
  session: string;
  name: string;
  isCurrent: boolean;
  isPublished: boolean;
  bookings: number;
  signedOn: string | null;
}

export interface VenueRow {
  code: string;
  name: string;
  seats: number;
  sortOrder: number;
  bookings: number;
}

export function SettingsPanel({ semesters, venues }: { semesters: SemesterRow[]; venues: VenueRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const current = semesters.find((s) => s.isCurrent) ?? semesters[0];
  // Suggest the first semester after the current one that hasn't been created yet.
  let suggested = current ? nextSemester(current.session, current.name) : { session: "", name: SEMESTER_NAMES[0] as string };
  for (let i = 0; i < 20 && semesters.some((x) => x.session === suggested.session && x.name === suggested.name); i++) {
    suggested = nextSemester(suggested.session, suggested.name);
  }
  const [form, setForm] = useState({
    session: suggested.session,
    name: suggested.name,
    copyFrom: (current?.id ?? null) as number | null,
    copyMode: "fixed" as CopyMode,
    makeCurrent: false,
  });
  const [confirmSwitch, setConfirmSwitch] = useState<number | null>(null);
  const [newVenue, setNewVenue] = useState({ code: "", name: "", seats: "", sortOrder: String((venues.at(-1)?.sortOrder ?? 0) + 1) });

  const run = (p: Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      const r = await p;
      toast(r.ok ? r.message ?? "Saved." : r.error, !r.ok);
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <>
      <section className="card">
        <h2>Semesters</h2>
        <p className="hint">
          The <b>current</b> semester is the one everyone sees and edits in the app. <b>Published</b> semesters appear on the
          public timetable page for students and lecturers.
        </p>
        <div className="tblwrap">
          <table className="t">
            <thead>
              <tr>
                <th>Semester</th>
                <th>Bookings</th>
                <th>Sign-off</th>
                <th>In the app</th>
                <th>Public timetable</th>
              </tr>
            </thead>
            <tbody>
              {semesters.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.session}</b> {s.name}
                  </td>
                  <td className="num">{s.bookings}</td>
                  <td>{s.signedOn ? <span className="pill ok">Signed</span> : <span className="hint">Not signed</span>}</td>
                  <td>
                    {s.isCurrent ? (
                      <span className="pill ok">Current</span>
                    ) : (
                      <button
                        type="button"
                        className={`btn${confirmSwitch === s.id ? " primary" : ""}`}
                        disabled={pending}
                        onClick={() => {
                          if (confirmSwitch !== s.id) return setConfirmSwitch(s.id);
                          setConfirmSwitch(null);
                          run(setCurrentSemester(s.id));
                        }}
                      >
                        {confirmSwitch === s.id ? "Confirm: switch everyone" : "Make current"}
                      </button>
                    )}
                  </td>
                  <td>
                    <PublishToggle s={s} disabled={pending} onChange={(v) => run(setPublished(s.id, v))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="sub">Start a new semester</h3>
        <form
          className="new-sem"
          onSubmit={(e) => {
            e.preventDefault();
            run(createSemester(form));
          }}
        >
          <label className="fld">
            <span>Session</span>
            <input id="sem-session" value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} placeholder="2026/2027" />
          </label>
          <label className="fld">
            <span>Semester</span>
            <select id="sem-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}>
              {SEMESTER_NAMES.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="fld">
            <span>Copy from</span>
            <select
              id="sem-copy-from"
              value={form.copyFrom ?? ""}
              onChange={(e) => setForm({ ...form, copyFrom: e.target.value ? Number(e.target.value) : null, copyMode: e.target.value ? form.copyMode : "none" })}
            >
              <option value="">— Don&apos;t copy —</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.session} {s.name}
                </option>
              ))}
            </select>
          </label>
          {form.copyFrom && (
            <fieldset className="copy-modes">
              <legend>What to copy</legend>
              {(Object.keys(COPY_MODES) as CopyMode[]).map((m) => (
                <label key={m} className="radio">
                  <input type="radio" name="copyMode" value={m} checked={form.copyMode === m} onChange={() => setForm({ ...form, copyMode: m })} />
                  <span>
                    <b>{COPY_MODES[m].label}</b>
                    <small>{COPY_MODES[m].hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <label className="toggle-row">
            <input type="checkbox" checked={form.makeCurrent} onChange={(e) => setForm({ ...form, makeCurrent: e.target.checked })} />
            Make it the current semester straight away
          </label>
          <div>
            <button className="btn primary" type="submit" disabled={pending}>
              Create semester
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Venues</h2>
        <p className="hint">Order sets where each venue appears on the timetable and printouts (lowest first).</p>
        <div className="tblwrap">
          <table className="t">
            <thead>
              <tr>
                <th>Code</th>
                <th>Description (printed in the venue key)</th>
                <th>Seats</th>
                <th>Order</th>
                <th>Bookings</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <VenueEditRow key={v.code} v={v} pending={pending} onSave={(x) => run(saveVenue({ ...x, isNew: false }))} />
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="addrow"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              saveVenue({ code: newVenue.code, name: newVenue.name, seats: Number(newVenue.seats), sortOrder: Number(newVenue.sortOrder), isNew: true }),
              () => setNewVenue({ code: "", name: "", seats: "", sortOrder: String(Number(newVenue.sortOrder) + 1) }),
            );
          }}
        >
          <label className="fld" style={{ minWidth: 90 }}>
            <span>Code</span>
            <input id="venue-code" value={newVenue.code} onChange={(e) => setNewVenue({ ...newVenue, code: e.target.value })} placeholder="P5" />
          </label>
          <label className="fld" style={{ minWidth: 260 }}>
            <span>Description</span>
            <input id="venue-name" value={newVenue.name} onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })} placeholder="First Floor LT, Statistics Building" />
          </label>
          <label className="fld" style={{ minWidth: 90 }}>
            <span>Seats</span>
            <input id="venue-seats" type="number" min={1} value={newVenue.seats} onChange={(e) => setNewVenue({ ...newVenue, seats: e.target.value })} />
          </label>
          <label className="fld" style={{ minWidth: 80 }}>
            <span>Order</span>
            <input id="venue-order" type="number" min={0} value={newVenue.sortOrder} onChange={(e) => setNewVenue({ ...newVenue, sortOrder: e.target.value })} />
          </label>
          <button className="btn primary" type="submit" disabled={pending}>
            Add venue
          </button>
        </form>
      </section>
    </>
  );
}

/** Ticks immediately; the server confirms (or the page corrects itself) a moment later. */
function PublishToggle({ s, disabled, onChange }: { s: SemesterRow; disabled: boolean; onChange: (v: boolean) => void }) {
  const [on, setOn] = useState(s.isPublished);
  useEffect(() => setOn(s.isPublished), [s.isPublished]);
  return (
    <label className="toggle-row">
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={(e) => {
          setOn(e.target.checked);
          onChange(e.target.checked);
        }}
        aria-label={`Publish ${s.session} ${s.name}`}
      />
      {on ? "Published" : "Draft"}
    </label>
  );
}

function VenueEditRow({ v, pending, onSave }: { v: VenueRow; pending: boolean; onSave: (x: { code: string; name: string; seats: number; sortOrder: number }) => void }) {
  const [name, setName] = useState(v.name);
  const [seats, setSeats] = useState(String(v.seats));
  const [order, setOrder] = useState(String(v.sortOrder));
  const dirty = name !== v.name || seats !== String(v.seats) || order !== String(v.sortOrder);
  return (
    <tr>
      <td className="code">{v.code}</td>
      <td>
        <input aria-label={`${v.code} description`} value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
      </td>
      <td>
        <input aria-label={`${v.code} seats`} className="seats-in num" type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} />
      </td>
      <td>
        <input aria-label={`${v.code} order`} className="seats-in num" type="number" min={0} value={order} onChange={(e) => setOrder(e.target.value)} />
      </td>
      <td className="num">{v.bookings}</td>
      <td>
        {dirty && (
          <button type="button" className="btn primary" disabled={pending} onClick={() => onSave({ code: v.code, name, seats: Number(seats), sortOrder: Number(order) })}>
            Save
          </button>
        )}
      </td>
    </tr>
  );
}
