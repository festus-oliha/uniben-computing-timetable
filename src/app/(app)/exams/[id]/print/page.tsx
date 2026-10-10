import Link from "next/link";
import { notFound } from "next/navigation";
import { examSignoff, getExamBoard, getExamRow } from "@/lib/exam-data";
import { buildExamDoc } from "@/lib/export/exam-layout";
import { CREST_PNG_BASE64 } from "@/lib/export/crest";
import { fitSignature, formatSignedDate } from "@/lib/signoff";
import { PrintButton } from "@/components/PrintButton";
import "./exam-print.css";

export const metadata = { title: "Print examination timetable — Faculty of Computing" };

/** The examination timetable on A4 portrait. Use the browser's print dialog → "Save as PDF". */
export default async function ExamPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = Number.isInteger(Number(id)) ? await getExamBoard(Number(id)) : null;
  if (!data) notFound();
  const signoff = examSignoff((await getExamRow(data.timetable.id))!);
  const doc = buildExamDoc(data.timetable, data.papers, data.venues);
  const sig = signoff.image && signoff.width && signoff.height ? fitSignature(signoff.width, signoff.height, 180, 60) : null;
  const cols = doc.sessions.length + 1;

  return (
    <div className="xp-root">
      <div className="print-toolbar">
        <PrintButton />
        <a className="btn" href={`/export/exam/${data.timetable.id}`}>
          Download Word (.docx)
        </a>
        <Link className="btn" href={`/exams/${data.timetable.id}`}>
          Back to the timetable
        </Link>
        <span className="hint">In the print dialog choose “Save as PDF”, Portrait, A4, and turn off headers and footers.</span>
      </div>

      <section className="xp-sheet">
        <header className="xp-title">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${CREST_PNG_BASE64}`} alt="University of Benin crest" />
          <div>
            <h1>{doc.faculty}</h1>
            <small>{doc.university}</small>
            {doc.department && <p className="dept">{doc.department}</p>}
            <p>{doc.title}</p>
          </div>
        </header>

        <table className="xp-grid">
          <colgroup>
            <col style={{ width: "13%" }} />
            {doc.sessions.map((_, i) => (
              <col key={i} style={{ width: `${87 / doc.sessions.length}%` }} />
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
                  <td colSpan={cols}>{r.label}</td>
                </tr>
              ) : (
                <tr key={i}>
                  <td className="d">
                    <b>{r.day}</b>
                    <span>{r.date}</span>
                  </td>
                  {r.cells.map((c) => (
                    <td key={c.number}>
                      <span className="sn">SESSION {c.number}</span>
                      {c.lines.map((l, k) => (
                        <span key={k} className={l.block ? "blk" : "ln"}>
                          {l.text}
                        </span>
                      ))}
                    </td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>

        <div className="xp-two">
          <div>
            {doc.notes.length > 0 && (
              <>
                <h2>NOTE THE FOLLOWING</h2>
                <ol className="xp-notes">
                  {doc.notes.map((n, i) => (
                    <li key={i}>
                      <span>{i + 1}.</span>
                      {n}
                    </li>
                  ))}
                </ol>
              </>
            )}
            {doc.closing && <p className="closing">{doc.closing}</p>}
          </div>
          <div>
            {doc.venues.length > 0 && (
              <>
                <h2>KEY TO VENUE ALLOCATION</h2>
                <table className="xp-key">
                  <tbody>
                    {doc.venues.map((v) => (
                      <tr key={v.code}>
                        <td>
                          <b>{v.code}</b>
                        </td>
                        <td>{v.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        <div className="xp-two foot">
          <div className="xp-cc">
            <b>cc:</b>
            <ul>{doc.cc.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
          <div className="xp-sign">
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
        </div>
      </section>
    </div>
  );
}
