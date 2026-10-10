"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dateLabel } from "@/lib/exam";
import { printName } from "@/lib/invigilation";
import { DEPARTMENTS } from "@/lib/timetable";
import type { ExamBoardData } from "@/lib/types";
import { addUnavailability, removeUnavailability, replaceInvigilator, saveInvigilationSettings } from "@/app/invigilation-actions";
import { useToast } from "../Toast";

/** Who invigilates, how many per paper, who is away, and handing duties over. */
export function InvigilationSettings({ data, pool }: { data: ExamBoardData; pool: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const t = data.timetable;
  const staff = [...data.lecturers].sort((a, b) => (a.dept ?? "").localeCompare(b.dept ?? "") || a.name.localeCompare(b.name));
  const nameOf = (id: string) => data.lecturers.find((l) => l.id === id);

  const [perPaper, setPerPaper] = useState(String(t.assistantsPerPaper));
  const [perDay, setPerDay] = useState(String(t.maxDutiesPerDay));
  const [custom, setCustom] = useState(t.invigilatorPool !== null);
  const [chosen, setChosen] = useState<string[]>(pool);

  const [who, setWho] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [session, setSession] = useState("all");
  const [reason, setReason] = useState("");
  const [takeOff, setTakeOff] = useState(true);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fromDate, setFromDate] = useState("");

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) {
    startTransition(async () => {
      const r = await fn();
      toast((r.ok ? r.message : r.error) ?? "Done.", !r.ok);
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  const depts = [...new Set(staff.map((l) => l.dept ?? ""))];

  return (
    <div className="inv-settings">
      <section className="card">
        <h2>Invigilators and numbers</h2>
        <div className="row2" style={{ maxWidth: 420 }}>
          <label className="fld">
            <span>Assistants per paper</span>
            <input id="inv-per-paper" type="number" min={0} max={30} value={perPaper} onChange={(e) => setPerPaper(e.target.value)} />
          </label>
          <label className="fld">
            <span>Most duties a day</span>
            <input id="inv-per-day" type="number" min={1} max={6} value={perDay} onChange={(e) => setPerDay(e.target.value)} />
          </label>
        </div>
        <p className="hint">Change the number for one big paper (e.g. one written in several halls) by clicking it.</p>
        <fieldset className="copy-modes" style={{ marginTop: 10 }}>
          <legend>Who can be suggested as an assistant</legend>
          <label className="radio">
            <input type="radio" checked={!custom} onChange={() => (setCustom(false), setChosen(pool))} />
            <span>
              The usual list
              <small>{t.dept ? `All ${DEPARTMENTS[t.dept] ?? t.dept} staff on the Lecturers tab` : "Everyone on the Lecturers tab"}</small>
            </span>
          </label>
          <label className="radio">
            <input type="radio" checked={custom} onChange={() => setCustom(true)} />
            <span>
              Only the people I tick
              <small>Anyone can still be added to a paper by hand.</small>
            </span>
          </label>
          {custom && (
            <div className="pool">
              {depts.map((d) => (
                <div key={d || "none"}>
                  <b>{d ? DEPARTMENTS[d] ?? d : "No department"}</b>
                  {staff
                    .filter((l) => (l.dept ?? "") === d)
                    .map((l) => (
                      <label key={l.id} className="toggle-row">
                        <input type="checkbox" checked={chosen.includes(l.id)} onChange={(e) => setChosen((c) => (e.target.checked ? [...c, l.id] : c.filter((x) => x !== l.id)))} />
                        {printName(l)} <span className="hint">{l.name}</span>
                      </label>
                    ))}
                </div>
              ))}
              {staff.length === 0 && <p className="hint">No staff yet — add them on the Lecturers tab (you can paste a whole list).</p>}
            </div>
          )}
        </fieldset>
        <div className="actions" style={{ padding: 0 }}>
          <button
            type="button"
            className="btn primary"
            disabled={pending}
            onClick={() => run(() => saveInvigilationSettings(t.id, { assistantsPerPaper: Number(perPaper), maxDutiesPerDay: Number(perDay), pool: custom ? chosen : null }))}
          >
            Save
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Unavailable</h2>
        <p className="hint">Someone travelling, sick or on other duty. They won&apos;t be suggested then, and can&apos;t be chosen.</p>
        {data.unavailable.length > 0 && (
          <ul className="offlist">
            {data.unavailable.map((u) => {
              const l = nameOf(u.lecturerId);
              return (
                <li key={u.id}>
                  <b>{l ? printName(l) : "?"}</b> {dateLabel(u.date).day} {dateLabel(u.date).date}
                  {u.session === null ? " (all day)" : ` (${t.sessions[u.session]?.name})`}
                  {u.reason && <span className="hint"> — {u.reason}</span>}
                  <button type="button" className="linkbtn" onClick={() => run(() => removeUnavailability(u.id))}>
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="row2">
          <label className="fld">
            <span>Person</span>
            <select id="off-who" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Choose…</option>
              {staff.map((l) => (
                <option key={l.id} value={l.id}>
                  {printName(l)} — {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="fld">
            <span>Session</span>
            <select id="off-session" value={session} onChange={(e) => setSession(e.target.value)}>
              <option value="all">Whole day</option>
              {t.sessions.map((s, i) => (
                <option key={i} value={i}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="fld" style={{ marginTop: 10 }}>
          <span>Dates</span>
          <div className="venue-pick">
            {t.dates.map((d) => (
              <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}>
                {dateLabel(d).day} {dateLabel(d).date}
              </button>
            ))}
          </div>
        </div>
        <label className="fld" style={{ marginTop: 10 }}>
          <span>Reason (optional)</span>
          <input id="off-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. conference" />
        </label>
        <label className="toggle-row" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={takeOff} onChange={(e) => setTakeOff(e.target.checked)} /> Take them off any duties they already have then
        </label>
        <div className="actions" style={{ padding: 0 }}>
          <button
            type="button"
            className="btn primary"
            disabled={pending || !who || !days.length}
            onClick={() =>
              run(
                () => addUnavailability(t.id, { lecturerId: who, dates: days, session: session === "all" ? null : Number(session), reason, removeFromPapers: takeOff }),
                () => (setDays([]), setReason("")),
              )
            }
          >
            Mark unavailable
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Hand over duties</h2>
        <p className="hint">Moves one person&apos;s duties to someone else. Any duty the new person can&apos;t take (busy then, unavailable, or lectures the course when the duty is chief) is left for you to assign.</p>
        <div className="row2">
          <label className="fld">
            <span>From</span>
            <select id="hand-from" value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">Choose…</option>
              {staff.map((l) => (
                <option key={l.id} value={l.id}>
                  {printName(l)} — {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="fld">
            <span>To</span>
            <select id="hand-to" value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">Choose…</option>
              {staff
                .filter((l) => l.id !== from)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {printName(l)} — {l.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label className="fld" style={{ marginTop: 10, maxWidth: 260 }}>
          <span>From date (optional)</span>
          <select value={fromDate} onChange={(e) => setFromDate(e.target.value)}>
            <option value="">All their duties</option>
            {t.dates.map((d) => (
              <option key={d} value={d}>
                {dateLabel(d).day} {dateLabel(d).date} onwards
              </option>
            ))}
          </select>
        </label>
        <div className="actions" style={{ padding: 0 }}>
          <button type="button" className="btn primary" disabled={pending || !from || !to} onClick={() => run(() => replaceInvigilator(t.id, from, to, fromDate || null))}>
            Hand over
          </button>
        </div>
      </section>
    </div>
  );
}
