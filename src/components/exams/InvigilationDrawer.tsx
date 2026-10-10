"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dateLabel, paperText } from "@/lib/exam";
import { courseLecturers, dutyCounts, eligibility, invigilationIssues, suggestAssistants, type InvPaper } from "@/lib/invigilation";
import type { ExamBoardData } from "@/lib/types";
import { assignInvigilators } from "@/app/invigilation-actions";
import { useToast } from "../Toast";
import { useInvCtx } from "./InvigilationBoard";

/** Choose one paper's chief invigilator (always by hand) and its assistants. */
export function InvigilationDrawer({ paper, data, canManage, onClose }: { paper: InvPaper; data: ExamBoardData; canManage: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const { ctx, short, pool } = useInvCtx(data);
  const t = data.timetable;
  const all = data.papers as InvPaper[];
  const [chief, setChief] = useState<string>(paper.chiefId ?? "");
  const [assistants, setAssistants] = useState<string[]>(paper.invigilatorIds.filter((x) => x !== paper.chiefId));
  const [need, setNeed] = useState<string>(paper.assistantsNeeded === null ? "" : String(paper.assistantsNeeded));
  const [adding, setAdding] = useState("");

  useEffect(() => {
    setChief(paper.chiefId ?? "");
    setAssistants(paper.invigilatorIds.filter((x) => x !== paper.chiefId));
    setNeed(paper.assistantsNeeded === null ? "" : String(paper.assistantsNeeded));
  }, [paper]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const draft: InvPaper = { ...paper, chiefId: chief || null, invigilatorIds: assistants, assistantsNeeded: need === "" ? null : Number(need) };
  const others = all.filter((p) => p.id !== paper.id);
  const withDraft = [...others, draft];
  const counts = dutyCounts(withDraft.filter((p) => p.kind === "paper"));
  const lec = courseLecturers(paper, ctx);
  const needNow = draft.assistantsNeeded ?? t.assistantsPerPaper;

  // Everyone who could be listed: the invigilators list, plus anyone already on this paper.
  const everyone = [...new Set([...pool, ...data.lecturers.map((l) => l.id)])];
  const option = (id: string, role: "chief" | "assistant") => {
    const e = eligibility(id, role, draft, others, ctx);
    const c = counts.get(id);
    return { id, name: ctx.name(id), short: short(id), hard: e.hard, soft: e.soft, chief: c?.chief ?? 0, total: c?.total ?? 0, inPool: pool.includes(id) };
  };
  const chiefOptions = everyone
    .filter((id) => !assistants.includes(id))
    .map((id) => option(id, "chief"))
    .sort((a, b) => Number(!!a.hard) - Number(!!b.hard) || Number(!a.inPool) - Number(!b.inPool) || a.chief - b.chief || a.total - b.total || a.name.localeCompare(b.name));
  const addOptions = everyone
    .filter((id) => id !== chief && !assistants.includes(id))
    .map((id) => option(id, "assistant"))
    .sort((a, b) => Number(!!a.hard) - Number(!!b.hard) || Number(!a.inPool) - Number(!b.inPool) || a.total - b.total || a.name.localeCompare(b.name));

  const issues = invigilationIssues(withDraft, ctx).filter((i) => i.paperIds.includes(paper.id));

  function suggest() {
    const s = suggestAssistants(withDraft, pool, ctx, new Set([paper.id]));
    const next = s.get(paper.id);
    if (next) setAssistants(next);
    else toast("Nobody suitable is free for the empty places in this session.", true);
  }

  function save() {
    startTransition(async () => {
      const r = await assignInvigilators(paper.id, { chiefId: chief || null, invigilatorIds: assistants, assistantsNeeded: need === "" ? null : Number(need) });
      if (r.ok) {
        toast(r.message ?? "Saved.");
        router.refresh();
        onClose();
      } else toast(r.error, true);
    });
  }

  const dl = dateLabel(paper.date);
  const label = (o: ReturnType<typeof option>, role: "chief" | "assistant") =>
    `${o.short} — ${o.name}${o.hard ? ` (${o.hard})` : `${o.soft ? ` (${o.soft})` : ""} · ${role === "chief" ? `${o.chief} as chief, ` : ""}${o.total} dut${o.total === 1 ? "y" : "ies"}`}${o.inPool ? "" : " · not on the list"}`;

  return (
    <div className="drawer" role="dialog" aria-modal="false" aria-labelledby="inv-title">
      <header>
        <h3 id="inv-title">{paperText(paper)}</h3>
        <button type="button" className="xbtn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="body">
        <p className="hint" style={{ margin: 0 }}>
          {dl.long} {dl.full} · {t.sessions[paper.session]?.name} ({t.sessions[paper.session]?.time})
          <br />
          {lec.size ? `Course lecturer${lec.size > 1 ? "s" : ""}: ${[...lec].map(short).join(", ")}` : "No course lecturer recorded (set it on the Courses tab)."}
        </p>
        <fieldset disabled={!canManage} className="plain">
          <label className="fld">
            <span>Chief invigilator</span>
            <select id="inv-chief" value={chief} onChange={(e) => setChief(e.target.value)}>
              <option value="">— Choose the chief invigilator —</option>
              {chiefOptions.map((o) => (
                <option key={o.id} value={o.id} disabled={!!o.hard && o.id !== chief}>
                  {label(o, "chief")}
                </option>
              ))}
            </select>
          </label>
          <p className="hint" style={{ margin: 0 }}>
            The chief is always chosen by you. People who lecture this course, are unavailable or are busy in this session can&apos;t be chosen. Listed with the fewest chief duties first.
          </p>
          <label className="fld">
            <span>Assistants needed</span>
            <input id="inv-need" type="number" min={0} max={30} value={need} placeholder={`Usual: ${t.assistantsPerPaper}`} onChange={(e) => setNeed(e.target.value)} />
          </label>
          <div className="fld">
            <span>
              Assistants ({assistants.length}/{needNow})
            </span>
            <div className="people">
              {assistants.length === 0 && <span className="hint">None yet.</span>}
              {assistants.map((id) => {
                const e = eligibility(id, "assistant", draft, others, ctx);
                return (
                  <span key={id} className={`person${e.hard ? " bad" : e.soft ? " soft" : ""}`} title={e.hard ?? e.soft ?? ctx.name(id)}>
                    {short(id)}
                    {canManage && (
                      <button type="button" aria-label={`Remove ${short(id)}`} onClick={() => setAssistants((a) => a.filter((x) => x !== id))}>
                        ×
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
          {canManage && (
            <div className="row2" style={{ gridTemplateColumns: "1fr auto", alignItems: "end" }}>
              <label className="fld">
                <span>Add an assistant</span>
                <select id="inv-add" value={adding} onChange={(e) => setAdding(e.target.value)}>
                  <option value="">Choose…</option>
                  {addOptions.map((o) => (
                    <option key={o.id} value={o.id} disabled={!!o.hard}>
                      {label(o, "assistant")}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="btn" disabled={!adding} onClick={() => (setAssistants((a) => [...a, adding]), setAdding(""))}>
                Add
              </button>
            </div>
          )}
          {canManage && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={suggest} disabled={assistants.length >= needNow}>
                Suggest for empty places
              </button>
              <button type="button" className="btn" onClick={() => setAssistants([])} disabled={!assistants.length}>
                Clear assistants
              </button>
            </div>
          )}
        </fieldset>
        {issues.map((i, k) => (
          <div key={k} className={`issue${i.severity === "warning" ? " warn" : ""}`}>
            {i.message}
          </div>
        ))}
      </div>
      <div className="actions">
        {canManage && (
          <button type="button" className="btn primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        )}
        <button type="button" className="btn" onClick={onClose}>
          {canManage ? "Cancel" : "Close"}
        </button>
      </div>
    </div>
  );
}
