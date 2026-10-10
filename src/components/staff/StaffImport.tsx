"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importStaff } from "@/app/staff-actions";
import { CATEGORIES, FIELD_LABELS, detectColumns, parsePasted, rowsToStaff, type StaffField } from "@/lib/staff";
import { DEPARTMENTS } from "@/lib/timetable";
import { useToast } from "../Toast";

type Sheet = { name: string; rows: string[][] };

/** Load a staff list from Excel / CSV, or a table pasted from Excel or Word: match the columns, check, then load. */
export function StaffImport({ deptOfficer }: { deptOfficer: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIx, setSheetIx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [columns, setColumns] = useState<(StaffField | null)[]>([]);
  const [pasted, setPasted] = useState("");
  const [result, setResult] = useState<{ added: number; updated: number; skipped: string[] } | null>(null);

  const rows = sheets[sheetIx]?.rows ?? [];
  const headers = rows[headerRow] ?? [];
  const body = rows.slice(headerRow + 1);
  const parsed = useMemo(() => (columns.includes("name") ? rowsToStaff(body, columns) : null), [body, columns]);

  function applyRows(list: Sheet[]) {
    setSheets(list);
    setSheetIx(0);
    setResult(null);
    pickHeader(list[0]?.rows ?? []);
  }

  /** The heading row is the first row (of the first ten) whose cells look like column names. */
  function pickHeader(r: string[][]) {
    let best = 0;
    let bestScore = -1;
    r.slice(0, 10).forEach((row, i) => {
      const score = detectColumns(row.map(String)).filter(Boolean).length;
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    });
    setHeaderRow(best);
    setColumns(detectColumns((r[best] ?? []).map(String)));
  }

  async function readFile(f: File | undefined) {
    if (!f) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const list = wb.SheetNames.map((name) => ({
        name,
        rows: (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: false }) as unknown[][])
          .map((r) => r.map((c) => String(c ?? "").trim()))
          .filter((r) => r.some(Boolean)),
      })).filter((s) => s.rows.length);
      if (!list.length) return toast("That file has no rows to read.", true);
      applyRows(list);
    } catch {
      toast("That file couldn't be read. Save it as .xlsx or .csv and try again, or paste the table instead.", true);
    }
  }

  function load() {
    if (!parsed?.staff.length) return;
    startTransition(async () => {
      const r = await importStaff(parsed.staff);
      if (!r.ok) return toast(r.error, true);
      setResult({ added: r.added ?? 0, updated: r.updated ?? 0, skipped: r.skipped ?? [] });
      toast(r.message ?? "Loaded.");
      router.refresh();
    });
  }

  return (
    <div className="imp">
      <section className="card">
        <h2>Load a staff list</h2>
        <p className="hint">
          Use an Excel or CSV file, or copy the table from Excel or Word and paste it below. People already on the list (same staff number, or the same name and initials) are updated, filling in only the cells that have something in them; everyone else is added.
          {deptOfficer ? ` As the ${deptOfficer} officer, only ${deptOfficer} staff will be loaded; rows with no department go into ${deptOfficer}.` : ""}
        </p>
        <div className="imp-src">
          <label className="btn primary">
            Choose an Excel or CSV file
            <input id="staff-file" type="file" accept=".xlsx,.xls,.csv,.ods" hidden onChange={(e) => readFile(e.target.files?.[0])} />
          </label>
          <span className="hint">or</span>
          <div className="imp-paste">
            <textarea id="staff-paste" rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={"Paste a table here — include the heading row, e.g.\nName\tRank\tDepartment\tEmail"} />
            <button type="button" className="btn" disabled={!pasted.trim()} onClick={() => applyRows([{ name: "Pasted", rows: parsePasted(pasted) }])}>
              Use pasted table
            </button>
          </div>
        </div>
      </section>

      {rows.length > 0 && (
        <section className="card">
          <h2>Match the columns</h2>
          <div className="bar">
            {sheets.length > 1 && (
              <label>
                Sheet
                <select
                  value={sheetIx}
                  onChange={(e) => {
                    const i = Number(e.target.value);
                    setSheetIx(i);
                    pickHeader(sheets[i].rows);
                  }}
                >
                  {sheets.map((s, i) => (
                    <option key={s.name} value={i}>
                      {s.name} ({s.rows.length} rows)
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Heading row
              <select
                value={headerRow}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  setHeaderRow(i);
                  setColumns(detectColumns((rows[i] ?? []).map(String)));
                }}
              >
                {rows.slice(0, 10).map((r, i) => (
                  <option key={i} value={i}>
                    Row {i + 1}: {r.filter(Boolean).slice(0, 3).join(", ").slice(0, 50)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="tblwrap">
            <table className="t imp-map">
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i}>
                      <span className="col-h">{h || `Column ${i + 1}`}</span>
                      <select
                        aria-label={`Column ${i + 1} holds`}
                        value={columns[i] ?? ""}
                        onChange={(e) => setColumns((c) => headers.map((_, k) => (k === i ? ((e.target.value || null) as StaffField | null) : c[k] === e.target.value ? null : c[k] ?? null)))}
                      >
                        <option value="">Ignore</option>
                        {(Object.keys(FIELD_LABELS) as StaffField[]).map((f) => (
                          <option key={f} value={f}>
                            {FIELD_LABELS[f]}
                          </option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.slice(0, 4).map((r, i) => (
                  <tr key={i}>
                    {headers.map((_, k) => (
                      <td key={k}>{r[k]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!columns.includes("name") && <p className="issue">Choose which column holds the names.</p>}
        </section>
      )}

      {parsed && (
        <section className="card">
          <h2>
            Check before loading: {parsed.staff.length} {parsed.staff.length === 1 ? "person" : "people"}
          </h2>
          {parsed.skipped.length > 0 && <p className="hint">{parsed.skipped.length} rows will be skipped (blank or no name).</p>}
          <div className="tblwrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Rank</th>
                  <th>Department</th>
                  <th>Category</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {parsed.staff.slice(0, 200).map((s, i) => (
                  <tr key={i}>
                    <td>{s.name}</td>
                    <td>{s.rank}</td>
                    <td>{s.dept ? DEPARTMENTS[s.dept] : <span className="pill warn">{deptOfficer ?? "Not recognised"}</span>}</td>
                    <td>{CATEGORIES[s.category].label}</td>
                    <td>{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.staff.length > 200 && <p className="hint">Showing the first 200.</p>}
          <div className="actions" style={{ padding: 0 }}>
            <button type="button" className="btn primary" disabled={pending || !parsed.staff.length} onClick={load}>
              {pending ? "Loading…" : `Load ${parsed.staff.length} ${parsed.staff.length === 1 ? "person" : "people"}`}
            </button>
          </div>
        </section>
      )}

      {result && (
        <section className="card">
          <h2>Done</h2>
          <p>
            <b>{result.added}</b> added and <b>{result.updated}</b> updated. <Link href="/workspace/staff">Open the staff list</Link>
          </p>
          {result.skipped.length > 0 && (
            <>
              <p className="hint">Notes (people not loaded, or loaded without a detail):</p>
              <ul>{result.skipped.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
