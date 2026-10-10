import Link from "next/link";
import { getExamBoard, getReleasedInvigilation } from "@/lib/exam-data";
import { dateLabel, paperText } from "@/lib/exam";
import { printName } from "@/lib/invigilation";
import { PROGRAMMES, isProgramme } from "@/lib/programmes";
import { DEPARTMENTS } from "@/lib/timetable";
import { PrintButton } from "@/components/PrintButton";
import { PublicShell } from "@/components/PublicShell";
import "../view.css";

export const metadata = {
  title: "Invigilation Schedule — Faculty of Computing, UNIBEN",
  description: "Look up your examination invigilation duties.",
};

const nameOf = (t: { programme: string; dept: string | null }) =>
  `${isProgramme(t.programme) ? PROGRAMMES[t.programme].label : t.programme}${t.dept ? ` · ${DEPARTMENTS[t.dept] ?? t.dept}` : ""}`;

/** Public, no sign-in: invigilators look up their duties. Only published invigilation schedules appear. */
export default async function PublicInvigilation({ searchParams }: { searchParams: Promise<{ t?: string; who?: string }> }) {
  const p = await searchParams;
  const list = await getReleasedInvigilation();
  const chosen = list.find((t) => String(t.id) === p.t) ?? (list.length === 1 ? list[0] : undefined);

  if (!list.length)
    return (
      <PublicShell subtitle="Invigilation Schedule">
        <section className="pv-card pv-empty">
          <h2>No invigilation schedule has been published yet</h2>
          <p>Check back soon, or ask the time-table officer.</p>
        </section>
      </PublicShell>
    );

  if (!chosen)
    return (
      <PublicShell subtitle="Invigilation Schedule">
        <section className="pv-card">
          <h2 className="pv-h">Choose a schedule</h2>
          <ul className="pv-list">
            {list.map((t) => (
              <li key={t.id}>
                <Link href={`/view/invigilation?t=${t.id}`}>
                  <b>{nameOf(t)}</b>
                  <span>{t.semesterLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </PublicShell>
    );

  const data = (await getExamBoard(chosen.id))!;
  const t = data.timetable;
  const real = data.papers.filter((x) => x.kind === "paper");
  const onDuty = new Set(real.flatMap((x) => [x.chiefId, ...x.invigilatorIds]).filter(Boolean) as string[]);
  const people = data.lecturers.filter((l) => onDuty.has(l.id)).sort((a, b) => printName(a).localeCompare(printName(b)));
  const person = people.find((l) => l.id === p.who);
  const short = new Map(data.lecturers.map((l) => [l.id, printName(l)]));
  const venueName = new Map(data.venues.map((v) => [v.code, v.name]));
  const mine = person
    ? real.filter((x) => x.chiefId === person.id || x.invigilatorIds.includes(person.id)).sort((a, b) => a.date.localeCompare(b.date) || a.session - b.session)
    : [];

  return (
    <PublicShell subtitle={`Invigilation Schedule · ${data.semester.session} ${data.semester.name}`}>
      <section className="pv-card pv-find">
        <p className="pv-crumb">
          {list.length > 1 && <Link href="/view/invigilation">All schedules</Link>}
          <b>{nameOf(t)}</b>
        </p>
        <form method="get" className="pv-form">
          <input type="hidden" name="t" value={t.id} />
          <label className="wide">
            <span>Your name</span>
            <select name="who" defaultValue={person?.id ?? ""} required>
              <option value="" disabled>
                Choose…
              </option>
              {people.map((l) => (
                <option key={l.id} value={l.id}>
                  {printName(l)} — {l.name}
                </option>
              ))}
            </select>
          </label>
          <button className="pv-go" type="submit">
            Show my duties
          </button>
        </form>
        <p className="pv-links">
          <a href={`/export/invigilation/${t.id}`}>Download the whole schedule (Word)</a>
        </p>
      </section>

      {person && (
        <section className="pv-card pv-week">
          <header className="pv-week-head">
            <div>
              <h2>{person.name}</h2>
              <p>
                {mine.length} dut{mine.length === 1 ? "y" : "ies"}
                {mine.some((x) => x.chiefId === person.id) ? ` · chief invigilator for ${mine.filter((x) => x.chiefId === person.id).length}` : ""}
              </p>
            </div>
            <div className="pv-noprint">
              <PrintButton />
            </div>
          </header>
          <ul className="pv-duties">
            {mine.map((x) => {
              const dl = dateLabel(x.date);
              const chief = x.chiefId === person.id;
              const team = [x.chiefId, ...x.invigilatorIds].filter((id): id is string => !!id && id !== person.id).map((id) => short.get(id));
              return (
                <li key={x.id} className={chief ? "chief" : ""}>
                  <span className="t">
                    {dl.long} {dl.full}
                    <br />
                    <small>
                      {t.sessions[x.session]?.name} · {t.sessions[x.session]?.time}
                    </small>
                  </span>
                  <span className="c">
                    <b>{paperText(x)}</b>
                    <em>{chief ? "Chief invigilator" : "Assistant"}</em>
                  </span>
                  {x.venues.length > 0 && <span className="v">{x.venues.map((v) => `${v} – ${venueName.get(v) ?? ""}`).join("; ")}</span>}
                  {team.length > 0 && <span className="l">With {team.join(", ")}</span>}
                </li>
              );
            })}
          </ul>
          <p className="pv-note">Arrive early. Changes are announced by the time-table officer; check this page again before each examination.</p>
        </section>
      )}
    </PublicShell>
  );
}
