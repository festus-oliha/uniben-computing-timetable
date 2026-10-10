"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dateLabel, paperText, sessionNumber, weekOf } from "@/lib/exam";
import { dutyCounts, invigilationIssues, needed, printName, resolvePool, type InvCtx, type InvIssue, type InvPaper } from "@/lib/invigilation";
import type { ExamBoardData } from "@/lib/types";
import { clearAssistants, fillAssistants, setInvigilationReleased } from "@/app/invigilation-actions";
import { useToast } from "../Toast";
import { InvigilationDrawer } from "./InvigilationDrawer";
import { InvigilationSettings } from "./InvigilationSettings";

/** Builds the rule context from loaded data (used by the board and the drawer). */
export function useInvCtx(data: ExamBoardData) {
  return useMemo(() => {
    const t = data.timetable;
    const course = new Map(data.courses.map((c) => [c.code, c]));
    const person = new Map(data.lecturers.map((l) => [l.id, l]));
    const ctx: InvCtx = {
      lecturersOf: (c) => course.get(c)?.lecturerIds ?? [],
      name: (id) => person.get(id)?.name ?? "Unknown",
      unavailable: data.unavailable,
      settings: { assistantsPerPaper: t.assistantsPerPaper, maxPerDay: t.maxDutiesPerDay, courseLecturersAssist: !["ug", "pt"].includes(t.programme) },
      sessionName: (s) => t.sessions[s]?.name ?? `session ${s + 1}`,
    };
    const short = (id: string) => (person.has(id) ? printName(person.get(id)!) : "?");
    const pool = resolvePool(t, data.lecturers);
    return { ctx, short, person, pool };
  }, [data]);
}

export function InvigilationBoard({ data, canManage }: { data: ExamBoardData; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const t = data.timetable;
  const { ctx, short, pool } = useInvCtx(data);
  const papers = data.papers as InvPaper[];
  const [open, setOpen] = useState<InvPaper | null>(null);
  const [flash, setFlash] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [released, setReleased] = useState(t.invigilationPublished);
  useEffect(() => setReleased(t.invigilationPublished), [t.invigilationPublished]);

  const issues = useMemo(() => invigilationIssues(papers, ctx), [papers, ctx]);
  const issueOf = useMemo(() => {
    const m = new Map<string, InvIssue[]>();
    for (const i of issues) for (const id of i.paperIds) m.set(id, [...(m.get(id) ?? []), i]);
    return m;
  }, [issues]);
  const counts = useMemo(() => dutyCounts(papers.filter((p) => p.kind === "paper")), [papers]);
  const real = papers.filter((p) => p.kind === "paper");
  const noChief = real.filter((p) => !p.chiefId).length;
  const short_ = real.filter((p) => new Set(p.invigilatorIds.filter((x) => x !== p.chiefId)).size < needed(p, ctx.settings)).length;
  const errors = issues.filter((i) => i.severity === "error");

  useEffect(() => {
    if (!flash.length) return;
    document.querySelector<HTMLElement>(`[data-paper="${CSS.escape(flash[0])}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const h = setTimeout(() => setFlash([]), 2600);
    return () => clearTimeout(h);
  }, [flash]);

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const r = await fn();
      toast((r.ok ? r.message : r.error) ?? "Done.", !r.ok);
      if (r.ok) router.refresh();
    });
  }

  function release(on: boolean) {
    setReleased(on);
    startTransition(async () => {
      const r = await setInvigilationReleased(t.id, on);
      if (r.ok) {
        toast(r.message ?? "Saved.");
        router.refresh();
      } else {
        setReleased(!on);
        toast(r.error, true);
      }
    });
  }

  // Everyone on the list, plus anyone with duties who isn't (so no duty goes uncounted).
  const people = [...new Set([...pool, ...counts.keys()])]
    .map((id) => ({ id, name: ctx.name(id), short: short(id), c: counts.get(id) }))
    .sort((a, b) => (b.c?.total ?? 0) - (a.c?.total ?? 0) || a.name.localeCompare(b.name));
  const totals = people.map((p) => p.c?.total ?? 0);
  const spread = totals.length ? Math.max(...totals) - Math.min(...totals) : 0;

  let lastWeek = 0;
  return (
    <>
      <div className="bar">
        <span className="hint">
          {real.length} papers · {noChief ? <b className="warn-t">{noChief} without a chief</b> : "every paper has a chief"} ·{" "}
          {short_ ? <b className="warn-t">{short_} short of assistants</b> : "assistants complete"}
          {errors.length ? (
            <>
              {" "}
              · <b className="bad-t">{errors.length} to fix</b>
            </>
          ) : null}
        </span>
        <div className="exports">
          {canManage && (
            <>
              <button type="button" className="btn primary" disabled={pending} onClick={() => run(() => fillAssistants(t.id))} title="Suggests assistants for empty places only. Chiefs and anyone already assigned are kept.">
                Fill empty places
              </button>
              <button
                type="button"
                className={`btn danger${confirmClear ? " sure" : ""}`}
                disabled={pending}
                onClick={() => (confirmClear ? (setConfirmClear(false), run(() => clearAssistants(t.id))) : setConfirmClear(true))}
              >
                {confirmClear ? "Confirm: clear all assistants" : "Clear assistants"}
              </button>
            </>
          )}
          <a className="btn" href={`/export/invigilation/${t.id}`}>
            Download Word
          </a>
          <a className="btn" href={`/exams/${t.id}/invigilation-print`}>
            Print / PDF
          </a>
        </div>
      </div>
      {canManage && (
        <label className="toggle-row release">
          <input type="checkbox" checked={released} onChange={(e) => release(e.target.checked)} />
          Publish this invigilation schedule, so invigilators can look up their duties on the Faculty site
        </label>
      )}

      {t.dates.length === 0 || real.length === 0 ? (
        <div className="card empty">Put the papers on the examination timetable first; their invigilators are arranged here.</div>
      ) : (
        <div className="layout">
          <div className="scroller">
            <div className="xgrid" style={{ gridTemplateColumns: `104px repeat(${t.sessions.length}, minmax(210px, 1fr))` }}>
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
                const showWeek = t.programme === "pt" && wk !== lastWeek;
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
                    <div key={`${date}-${si}`} className="xcell">
                      <span className="sn">SESSION {sessionNumber(di, si, t.sessions.length)}</span>
                      {papers
                        .filter((p) => p.date === date && p.session === si)
                        .sort((a, b) => a.label.localeCompare(b.label))
                        .map((p) => {
                          if (p.kind === "block")
                            return (
                              <div key={p.id} className="chip gen block">
                                <b>{p.label}</b>
                              </div>
                            );
                          const its = issueOf.get(p.id) ?? [];
                          const err = its.some((i) => i.severity === "error");
                          const have = new Set(p.invigilatorIds.filter((x) => x !== p.chiefId)).size;
                          const need = needed(p, ctx.settings);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              data-paper={p.id}
                              className={`inv${err ? " clash" : its.length ? " warnc" : ""}${flash.includes(p.id) ? " flash" : ""}`}
                              onClick={() => setOpen(p)}
                              title={its.map((i) => `⚠ ${i.message}`).join("\n") || undefined}
                            >
                              <span className="pp">{paperText(p)}</span>
                              <span className={`chief${p.chiefId ? "" : " none"}`}>{p.chiefId ? short(p.chiefId) : "No chief yet"}</span>
                              <span className="asst">
                                {p.invigilatorIds.filter((x) => x !== p.chiefId).map(short).join(", ") || "No assistants"}
                                <em className={have < need ? "short" : ""}>
                                  {" "}
                                  {have}/{need}
                                </em>
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )),
                ];
              })}
            </div>
          </div>
          <aside className="rail">
            <h2>Checks</h2>
            <div className="sum">
              <div className={errors.length ? "bad" : ""}>
                <b>{errors.length}</b>
                <span>To fix</span>
              </div>
              <div className={noChief ? "bad" : ""}>
                <b>{noChief}</b>
                <span>No chief</span>
              </div>
              <div className={short_ ? "bad" : ""}>
                <b>{short_}</b>
                <span>Short</span>
              </div>
            </div>
            {issues.length === 0 && <p className="okmsg">Every paper has a chief and its assistants, with no clashes.</p>}
            {[...errors, ...issues.filter((i) => i.severity === "warning")].slice(0, 50).map((i, k) => (
              <div key={k} className={`issue${i.severity === "warning" ? " warn" : ""}`}>
                {i.message}
                <br />
                <button type="button" className="linkbtn" onClick={() => setFlash(i.paperIds)}>
                  Show
                </button>
              </div>
            ))}
            <h2 style={{ marginTop: 16 }}>Duties per person</h2>
            <p className="hint">
              {people.length} on the list · difference between most and fewest duties: {spread}
            </p>
            <table className="duties">
              <thead>
                <tr>
                  <th>Name</th>
                  <th title="Chief invigilator">Chief</th>
                  <th title="Assistant">Asst.</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} className={p.c?.total ? "" : "zero"}>
                    <td title={p.name}>{p.short}</td>
                    <td>{p.c?.chief ?? 0}</td>
                    <td>{p.c?.assistant ?? 0}</td>
                    <td>
                      <b>{p.c?.total ?? 0}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </aside>
        </div>
      )}

      <p className="hint">
        {canManage
          ? "Click a paper to choose its chief invigilator and assistants. The chief is always your choice — a lecturer of the course can't be its chief. “Fill empty places” suggests assistants only where places are empty, spreading duties evenly; you can change any of them."
          : "View only. The time-table officer in charge arranges the invigilators."}
      </p>

      {canManage && <InvigilationSettings data={data} pool={pool} />}

      {open && <InvigilationDrawer paper={papers.find((p) => p.id === open.id) ?? open} data={data} canManage={canManage} onClose={() => setOpen(null)} />}
    </>
  );
}
