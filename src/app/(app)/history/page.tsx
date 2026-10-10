import Link from "next/link";
import { and, desc, ilike, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import { AUDIT_GROUPS } from "@/lib/audit";

export const metadata = { title: "History — FaCoMS Timetable" };

const PAGE = 100;
/** Account and settings changes are only shown to the Faculty Time-Table Officer. */
const ADMIN_ONLY = new Set(["accounts", "settings"]);

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ group?: string; q?: string; n?: string }> }) {
  const me = await requireUser();
  const params = await searchParams;
  const admin = isAdmin(me);
  const groups = Object.entries(AUDIT_GROUPS).filter(([k]) => admin || !ADMIN_ONLY.has(k));
  const group = groups.find(([k]) => k === params.group)?.[0] ?? "";
  const q = (params.q ?? "").trim().slice(0, 80);
  const limit = Math.min(Math.max(Number(params.n) || PAGE, PAGE), 2000);

  const allowed = (group ? [group] : groups.map(([k]) => k)).flatMap((k) => AUDIT_GROUPS[k].actions);
  const where: SQL[] = [inArray(auditLog.action, allowed)];
  if (q) where.push(or(ilike(auditLog.summary, `%${q}%`), ilike(auditLog.userName, `%${q}%`))!);

  const rows = await db.select().from(auditLog).where(and(...where)).orderBy(desc(auditLog.at), desc(auditLog.id)).limit(limit + 1);
  const more = rows.length > limit;
  const shown = rows.slice(0, limit);
  const groupOf = (action: string) => Object.entries(AUDIT_GROUPS).find(([, g]) => g.actions.includes(action))?.[1].label ?? "";
  const href = (o: Record<string, string>) => {
    const p = new URLSearchParams({ ...(group ? { group } : {}), ...(q ? { q } : {}), ...o });
    return `/history${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <section className="card">
      <h2>Change history</h2>
      <p className="hint">Every change to the timetable is recorded here with who made it and when, newest first.</p>
      <form className="bar" method="get">
        <label>
          Show
          <select name="group" defaultValue={group}>
            <option value="">All changes</option>
            {groups.map(([k, g]) => (
              <option key={k} value={k}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search <input type="text" name="q" defaultValue={q} placeholder="Course, venue or person" />
        </label>
        <button className="btn" type="submit">
          Apply
        </button>
        {(group || q) && (
          <Link className="linkbtn" href="/history">
            Clear
          </Link>
        )}
      </form>
      <div className="tblwrap">
        <table className="t history">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Area</th>
              <th>What changed</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">
                  {q || group ? "No changes match." : "No changes yet. Moves, edits and sign-offs will appear here."}
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="num when">
                  {r.at.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Lagos" })}
                  <br />
                  <span className="hint">{r.at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</span>
                </td>
                <td>{r.userName}</td>
                <td className="hint">{groupOf(r.action)}</td>
                <td>{r.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {more && (
        <p>
          <Link className="btn" href={href({ n: String(limit + PAGE) })}>
            Show older changes
          </Link>
        </p>
      )}
    </section>
  );
}
