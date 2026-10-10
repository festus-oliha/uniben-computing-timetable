import Link from "next/link";
import { notFound } from "next/navigation";
import { getExamBoard, getExamRow, invigilationSignoff } from "@/lib/exam-data";
import { buildInvigilationDoc } from "@/lib/export/invigilation-layout";
import { CREST_PNG_BASE64 } from "@/lib/export/crest";
import { fitSignature, formatSignedDate } from "@/lib/signoff";
import { PrintButton } from "@/components/PrintButton";
import "./inv-print.css";

export const metadata = { title: "Print invigilation schedule — Faculty of Computing" };

/** The invigilation schedule on A4 landscape, then each person's duties. */
export default async function InvigilationPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = Number.isInteger(Number(id)) ? await getExamBoard(Number(id)) : null;
  if (!data) notFound();
  const signoff = invigilationSignoff((await getExamRow(data.timetable.id))!);
  const doc = buildInvigilationDoc(data.timetable, data.papers, data.lecturers, data.venues);
  const sig = signoff.image && signoff.width && signoff.height ? fitSignature(signoff.width, signoff.height, 170, 56) : null;

  return (
    <div className="ip-root">
      <div className="print-toolbar">
        <PrintButton />
        <a className="btn" href={`/export/invigilation/${data.timetable.id}`}>
          Download Word (.docx)
        </a>
        <Link className="btn" href={`/exams/${data.timetable.id}?tab=invigilation`}>
          Back to invigilation
        </Link>
        <span className="hint">In the print dialog choose “Save as PDF”, Landscape, A4, and turn off headers and footers.</span>
      </div>

      <section className="ip-sheet">
        <header className="ip-title">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${CREST_PNG_BASE64}`} alt="University of Benin crest" />
          <div>
            <h1>{doc.heading[0]}</h1>
            <small>{doc.heading[1]}</small>
            <p>{doc.title}</p>
          </div>
        </header>
        <table className="ip-grid">
          <colgroup>
            <col style={{ width: "10%" }} />
            {doc.sessions.map((_, i) => (
              <col key={i} style={{ width: `${90 / doc.sessions.length}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>DATE</th>
              {doc.sessions.map((s, i) => (
                <th key={i}>
                  {s.name.toUpperCase()}
                  <small>{s.time}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doc.rows.map((r, i) =>
              r.type === "week" ? (
                <tr key={i} className="wk">
                  <td colSpan={doc.sessions.length + 1}>{r.label}</td>
                </tr>
              ) : (
                <tr key={i}>
                  <td className="d">
                    <b>{r.day}</b>
                    <span>{r.date}</span>
                  </td>
                  {r.cells.map((c) => (
                    <td key={c.number}>
                      {c.lines.map((l, k) =>
                        l.block ? (
                          <span key={k} className="blk">
                            {l.paper}
                          </span>
                        ) : (
                          <span key={k} className="ln">
                            <span className="pp">{l.paper}</span> <b>{l.chief || "______"}</b>
                            {l.assistants ? `: ${l.assistants}` : ""}
                          </span>
                        ),
                      )}
                    </td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>
        <div className="ip-foot">
          <div className="ip-sign">
            <p className="signed">Signed ({formatSignedDate(signoff.signedOn) ?? "____/____/______"})</p>
            {signoff.image && sig ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={signoff.image} alt="Signature" width={sig.width} height={sig.height} />
            ) : (
              <div className="space" />
            )}
            <p className="name">{doc.signatory.name || " "}</p>
            <p>{doc.signatory.role}</p>
            {doc.signatory.forWhom && <p className="for">{doc.signatory.forWhom}</p>}
          </div>
          {doc.levels.length > 0 && (
            <div>
              <h2>LEVEL</h2>
              <ul className="cols">{doc.levels.map((l) => <li key={l}>{l}</li>)}</ul>
            </div>
          )}
          {doc.venues.length > 0 && (
            <div>
              <h2>VENUE FOR EXAMINATION</h2>
              <ul>
                {doc.venues.map((v) => (
                  <li key={v.code}>
                    <b>{v.code}</b> – {v.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h2>KEY</h2>
            <p>
              <b>NAME</b> in bold — chief invigilator; the names after it are the assistant invigilators.
            </p>
          </div>
        </div>
      </section>

      {doc.duties.length > 0 && (
        <section className="ip-sheet ip-duties">
          <h2>DUTIES BY INVIGILATOR</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Chief</th>
                <th>Assistant</th>
                <th>Duties</th>
              </tr>
            </thead>
            <tbody>
              {doc.duties.map((d) => (
                <tr key={d.id}>
                  <td>
                    <b>{d.short}</b>
                    <small>{d.name}</small>
                  </td>
                  <td className="n">{d.chief}</td>
                  <td className="n">{d.assistant}</td>
                  <td>{d.duties.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
