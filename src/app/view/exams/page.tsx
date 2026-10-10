import Link from "next/link";
import { getExamBoard, getPublishedExamTimetables, examContext } from "@/lib/exam-data";
import { dateLabel, examEntries, type ExamFilter } from "@/lib/exam";
import { PROGRAMMES, isProgramme } from "@/lib/programmes";
import { DEPARTMENTS, FACULTY_DEPTS, levelName } from "@/lib/timetable";
import { PrintButton } from "@/components/PrintButton";
import { PublicShell } from "@/components/PublicShell";
import "../view.css";

export const metadata = {
  title: "Examination Timetable — FaCoMS, UNIBEN",
  description: "Find your examination dates, times and venues.",
};

type Params = { t?: string; level?: string; dept?: string; year?: string; all?: string; programme?: string };

const nameOf = (t: { programme: string; dept: string | null }) =>
  `${isProgramme(t.programme) ? PROGRAMMES[t.programme].label : t.programme}${t.dept ? ` · ${DEPARTMENTS[t.dept] ?? t.dept}` : ""}`;

/** Public, no sign-in: students look up their examinations. Only published examination timetables appear. */
export default async function PublicExams({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const all = await getPublishedExamTimetables();
  const list = p.programme ? all.filter((t) => t.programme === p.programme) : all;
  const chosen = list.find((t) => String(t.id) === p.t) ?? (list.length === 1 ? list[0] : undefined);

  if (!list.length) {
    return (
      <PublicShell subtitle="Examination Timetable">
        <section className="pv-card pv-empty">
          <h2>No examination timetable has been published yet</h2>
          <p>Check back soon, or ask your departmental time-table officer.</p>
        </section>
      </PublicShell>
    );
  }

  if (!chosen) {
    return (
      <PublicShell subtitle="Examination Timetable">
        <section className="pv-card">
          <h2 className="pv-h">Choose an examination timetable</h2>
          <ul className="pv-list">
            {list.map((t) => (
              <li key={t.id}>
                <Link href={`/view/exams?t=${t.id}`}>
                  <b>{nameOf(t)}</b>
                  <span>
                    {t.semesterLabel}
                    {t.dates.length ? ` · ${dateLabel(t.dates[0]).full} – ${dateLabel(t.dates.at(-1)!).full}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </PublicShell>
    );
  }

  const data = (await getExamBoard(chosen.id))!;
  const t = data.timetable;
  const ctx = examContext(data);
  const isUG = t.programme === "ug";
  const isPT = t.programme === "pt";
  const level = Number(p.level) || 0;
  const dept = FACULTY_DEPTS.includes(p.dept as never) ? (p.dept as string) : "";
  const year = /^Y[1-7]$/.test(p.year ?? "") ? p.year! : "";

  let filter: ExamFilter | null = null;
  let heading = "";
  if (p.all) {
    filter = { kind: "all" };
    heading = "Whole timetable";
  } else if (isUG && level && dept) {
    filter = { kind: "class", level, dept };
    heading = `${levelName(level)} · ${DEPARTMENTS[dept]}`;
  } else if (isPT && year) {
    filter = { kind: "year", year };
    heading = `Year ${year.slice(1)}`;
  } else if (!isUG && !isPT) {
    filter = { kind: "all" };
    heading = nameOf(t);
  }
  const entries = filter ? examEntries(filter, data.papers, ctx.course) : [];
  const venueName = new Map(data.venues.map((v) => [v.code, v.name]));
  const papersCount = entries.filter((e) => e.kind === "paper").length;
  const byDate = [...new Set(entries.map((e) => e.date))];

  return (
    <PublicShell subtitle={`Examination Timetable · ${data.semester.session} ${data.semester.name}`}>
      <section className="pv-card pv-find">
        <p className="pv-crumb">
          {list.length > 1 && <Link href="/view/exams">All examination timetables</Link>}
          <b>{nameOf(t)}</b>
        </p>
        {(isUG || isPT) && (
          <form method="get" className="pv-form">
            <input type="hidden" name="t" value={t.id} />
            {isUG ? (
              <>
                <label>
                  <span>Level</span>
                  <select name="level" defaultValue={level ? String(level) : ""} required>
                    <option value="" disabled>
                      Choose…
                    </option>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}00 Level
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Department</span>
                  <select name="dept" defaultValue={dept} required>
                    <option value="" disabled>
                      Choose…
                    </option>
                    {FACULTY_DEPTS.map((d) => (
                      <option key={d} value={d}>
                        {DEPARTMENTS[d]}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <label>
                <span>Year</span>
                <select name="year" defaultValue={year} required>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {["Y1", "Y2", "Y3", "Y4", "Y5", "Y6"].map((y) => (
                    <option key={y} value={y}>
                      Year {y.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button className="pv-go" type="submit">
              Show my examinations
            </button>
          </form>
        )}
        <p className="pv-links">
          <Link href={`/view/exams?t=${t.id}&all=1`}>See the whole timetable</Link> · <a href={`/export/exam/${t.id}`}>Download (Word)</a>
        </p>
      </section>

      {filter && (
        <section className="pv-card pv-week">
          <header className="pv-week-head">
            <div>
              <h2>{heading}</h2>
              <p>
                {data.semester.session} {data.semester.name} · {papersCount} paper{papersCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="pv-noprint">
              <PrintButton />
            </div>
          </header>
          {entries.length === 0 ? (
            <p className="pv-none">No examinations found for this selection.</p>
          ) : (
            byDate.map((d) => {
              const dl = dateLabel(d);
              return (
                <div key={d} className="pv-day">
                  <h3>
                    {dl.long} {dl.full}
                  </h3>
                  <ul>
                    {entries
                      .filter((e) => e.date === d)
                      .map((e) => (
                        <li key={e.id} className={e.kind === "block" ? "act" : ""}>
                          <span className="t">
                            {t.sessions[e.session]?.name}
                            <br />
                            <small>{t.sessions[e.session]?.time}</small>
                          </span>
                          <span className="c">
                            <b>{e.kind === "block" ? e.label : e.label.split("/").join(" / ")}</b>
                            {e.year && <em>{e.year}</em>}
                          </span>
                          {e.venues.length > 0 && (
                            <span className="v">
                              {e.venues.map((v, i) => (
                                <span key={v}>
                                  {i > 0 && ", "}
                                  <b>{v}</b> {venueName.get(v)}
                                </span>
                              ))}
                            </span>
                          )}
                          {e.note && <span className="l">{e.note}</span>}
                        </li>
                      ))}
                  </ul>
                </div>
              );
            })
          )}
          <p className="pv-note">
            Check the notice boards for changes. Clashes? Report them to your departmental time-table officer. Only students with valid
            identity cards may sit examinations.
          </p>
        </section>
      )}
    </PublicShell>
  );
}
