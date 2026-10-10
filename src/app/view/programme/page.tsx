import Link from "next/link";
import { getProgrammeBoard, getProgrammeRow, getPublishedProgrammeTimetables, programmeSignoff } from "@/lib/programme-data";
import { WEEKDAYS, groupRows, lecturersLookup, timeRange } from "@/lib/programme";
import { buildProgrammeDoc } from "@/lib/export/programme-layout";
import { PROGRAMMES, isProgramme } from "@/lib/programmes";
import { DEPARTMENTS, codesOf } from "@/lib/timetable";
import { PrintButton } from "@/components/PrintButton";
import { PublicShell } from "@/components/PublicShell";
import { ProgrammeSheet } from "@/components/programmes/ProgrammeSheet";
import "../view.css";

export const metadata = {
  title: "Part-time & Postgraduate Timetables — Faculty of Computing, UNIBEN",
  description: "Part-time, M.Sc., Ph.D. and PGD lecture timetables by department.",
};

const nameOf = (t: { programme: string; dept: string }) => `${isProgramme(t.programme) ? PROGRAMMES[t.programme].label : t.programme} · ${DEPARTMENTS[t.dept] ?? t.dept}`;

export default async function PublicProgramme({ searchParams }: { searchParams: Promise<{ t?: string; programme?: string; row?: string; all?: string }> }) {
  const p = await searchParams;
  const published = await getPublishedProgrammeTimetables();
  const list = p.programme ? published.filter((t) => t.programme === p.programme) : published;
  const latest = list.filter((t) => t.semesterId === Math.max(...list.map((x) => x.semesterId)));
  const chosen = list.find((t) => String(t.id) === p.t) ?? (latest.length === 1 ? latest[0] : undefined);
  const label = p.programme && isProgramme(p.programme) ? `${PROGRAMMES[p.programme].short} Lecture Timetable` : "Lecture Timetable";

  if (!list.length)
    return (
      <PublicShell subtitle={label}>
        <section className="pv-card pv-empty">
          <h2>This timetable hasn&apos;t been published yet</h2>
          <p>Check back soon, or ask your departmental time-table officer.</p>
        </section>
      </PublicShell>
    );

  if (!chosen)
    return (
      <PublicShell subtitle={label}>
        <section className="pv-card">
          <h2 className="pv-h">Choose your department</h2>
          <ul className="pv-list">
            {list.map((t) => (
              <li key={t.id}>
                <Link href={`/view/programme?t=${t.id}`}>
                  <b>{nameOf(t)}</b>
                  <span>{t.semesterLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </PublicShell>
    );

  const data = (await getProgrammeBoard(chosen.id))!;
  const t = data.timetable;
  const rows = groupRows(t.groups);
  const named = rows.some(Boolean);
  const row = named ? (p.row !== undefined && rows[Number(p.row)] !== undefined ? Number(p.row) : null) : 0;
  const lecturersOf = lecturersLookup(data.courses, data.courseLecturers);
  const person = new Map(data.lecturers.map((l) => [l.id, l.name]));
  const venue = new Map(t.venueKey.map((v) => [v.code, v.name]));
  const title = new Map(data.courses.map((c) => [c.code, c.title]));
  const mine = row === null ? [] : data.slots.filter((s) => s.group === row).sort((a, b) => t.days.indexOf(a.day) - t.days.indexOf(b.day) || a.start - b.start);

  return (
    <PublicShell subtitle={`${label} · ${data.semester.session} ${data.semester.name}`}>
      <section className="pv-card pv-find">
        <p className="pv-crumb">
          {list.length > 1 && <Link href={`/view/programme${p.programme ? `?programme=${p.programme}` : ""}`}>All departments</Link>}
          <b>{nameOf(t)}</b>
        </p>
        {named && (
          <form method="get" className="pv-form">
            <input type="hidden" name="t" value={t.id} />
            <label>
              <span>Year</span>
              <select name="row" defaultValue={row ?? ""} required>
                <option value="" disabled>
                  Choose…
                </option>
                {rows.map((g, i) => (
                  <option key={i} value={i}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <button className="pv-go" type="submit">
              Show my lectures
            </button>
          </form>
        )}
        <p className="pv-links">
          <Link href={`/view/programme?t=${t.id}&all=1`}>See the whole timetable</Link> · <a href={`/export/programme/${t.id}`}>Download (Word)</a>
        </p>
      </section>

      {p.all ? (
        <div className="pp-root land pv-sheet">
          <ProgrammeSheet doc={buildProgrammeDoc(t, data.slots, data.courses, data.lecturers)} signoff={programmeSignoff((await getProgrammeRow(t.id))!)} />
        </div>
      ) : row !== null ? (
        <section className="pv-card pv-week">
          <header className="pv-week-head">
            <div>
              <h2>{rows[row] || nameOf(t)}</h2>
              <p>
                {data.semester.session} {data.semester.name}
              </p>
            </div>
            <div className="pv-noprint">
              <PrintButton />
            </div>
          </header>
          {t.days.map((d) => {
            const today = mine.filter((s) => s.day === d);
            return (
              <div key={d} className="pv-day">
                <h3>{WEEKDAYS[d]}</h3>
                {today.length === 0 ? (
                  <p className="pv-free">No lectures</p>
                ) : (
                  <ul>
                    {today.map((s) => {
                      const lec = [...new Set(codesOf(s.label).flatMap(lecturersOf))].map((id) => person.get(id)).filter(Boolean);
                      return (
                        <li key={s.id} className={s.kind === "activity" ? "act" : ""}>
                          <span className="t">{timeRange(t.periods, s.start, s.span)}</span>
                          <span className="c">
                            <b>{s.label.split("/").join(" / ")}</b>
                            {codesOf(s.label).length === 1 && title.get(s.label) ? <em>{title.get(s.label)}</em> : null}
                          </span>
                          {s.venue && (
                            <span className="v">
                              <b>{s.venue}</b> {venue.get(s.venue) ?? ""}
                            </span>
                          )}
                          {lec.length > 0 && <span className="l">{lec.join(", ")}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
          {t.calendar.length > 0 && (
            <div className="pv-day">
              <h3>Calendar</h3>
              <ul className="pv-cal">
                {t.calendar.map((c, i) => (
                  <li key={i}>
                    <b>Weeks {c.weeks}</b> {c.dates} — {c.activity}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : null}
    </PublicShell>
  );
}
