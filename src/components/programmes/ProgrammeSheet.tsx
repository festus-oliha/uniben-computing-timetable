import { CREST_PNG_BASE64 } from "@/lib/export/crest";
import type { ProgDoc } from "@/lib/export/programme-layout";
import { fitSignature, formatSignedDate, type Signoff } from "@/lib/signoff";
import "./programme-sheet.css";

/** The printed timetable (also used by the public page). */
export function ProgrammeSheet({ doc, signoff }: { doc: ProgDoc; signoff: Signoff }) {
  const sig = signoff.image && signoff.width && signoff.height ? fitSignature(signoff.width, signoff.height, 170, 56) : null;
  return (
    <section className="pp-sheet">
      <header className="pp-title">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${CREST_PNG_BASE64}`} alt="University of Benin crest" />
        <div>
          <h1>{doc.heading[0]}</h1>
          <small>{doc.heading[1]}</small>
          <small>{doc.heading[2]}</small>
          <p>{doc.title}</p>
        </div>
      </header>
      <table className="pp-grid">
        <thead>
          <tr>
            <th>DAY</th>
            {doc.showGroups && <th>YEAR / TIME</th>}
            {doc.periods.map((p, i) => (
              <th key={i} className={p.isBreak ? "brk" : ""}>
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {doc.rows.map((r, ri) => (
            <tr key={ri} className={r.firstOfDay ? "first" : ""}>
              {r.firstOfDay && (
                <td className="d" rowSpan={r.rowsInDay}>
                  {r.day}
                </td>
              )}
              {doc.showGroups && <td className="g">{r.group}</td>}
              {r.cells.map((c) =>
                c.type === "break" ? (
                  r.firstOfDay ? (
                    <td key={c.start} className="b" rowSpan={r.rowsInDay}>
                      <span>BREAK</span>
                    </td>
                  ) : null
                ) : c.type === "slot" ? (
                  <td key={c.start} colSpan={c.span} className={c.activity ? "act" : "cls"}>
                    {c.text}
                  </td>
                ) : (
                  <td key={c.start} />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pp-below">
        {doc.venueKey.length > 0 && (
          <div>
            <h2>KEY TO VENUE ALLOCATION</h2>
            <p className="vk">
              {doc.venueKey.map((v) => (
                <span key={v.code}>
                  <b>{v.code}</b> = {v.name}
                </span>
              ))}
            </p>
          </div>
        )}
        {doc.calendar.length > 0 && (
          <div>
            <h2>CALENDAR</h2>
            <table className="pp-cal">
              <thead>
                <tr>
                  <th>WEEKS</th>
                  <th>DATES</th>
                  <th>ACTIVITIES</th>
                </tr>
              </thead>
              <tbody>
                {doc.calendar.map((c, i) => (
                  <tr key={i}>
                    <td>{c.weeks}</td>
                    <td>{c.dates}</td>
                    <td>{c.activity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {doc.notes.length > 0 && (
          <ul className="pp-notes">
            {doc.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
        {doc.allocation.length > 0 && (
          <div className="pp-alloc">
            <h2>COURSE ALLOCATION</h2>
            {doc.allocation.map((a) => (
              <div key={a.semester}>
                <h3>{a.semester}</h3>
                <ol>
                  {a.lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ol>
              </div>
            ))}
            {doc.hasCategories && <p className="hint-p">*Core courses; +Mandatory courses; E Elective courses</p>}
          </div>
        )}
        <div className="pp-sign">
          <p className="signed">Signed ({formatSignedDate(signoff.signedOn) ?? "____/____/______"})</p>
          {signoff.image && sig ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={signoff.image} alt="Signature" width={sig.width} height={sig.height} />
          ) : (
            <div className="space" />
          )}
          <p className="name">{doc.signatory.name || " "}</p>
          <p>{doc.signatory.role}</p>
        </div>
      </div>
    </section>
  );
}
