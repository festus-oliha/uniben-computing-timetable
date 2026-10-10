import Link from "next/link";
import { getTimetableData } from "@/lib/data";
import { printLayout, type PrintCell } from "@/lib/export/layout";
import { CREST_PNG_BASE64 } from "@/lib/export/crest";
import { DOCUMENT_TEXT as T, signedDate } from "@/lib/export/document-text";
import { DAYS, SLOTS } from "@/lib/timetable";
import { PrintButton } from "@/components/PrintButton";
import "./print.css";

export const metadata = { title: "Print timetable — Faculty of Computing" };

/** The official timetable laid out for paper (A4 landscape). Use the browser's print dialog → "Save as PDF". */
export default async function PrintPage() {
  const data = await getTimetableData();
  const venues = printLayout(data);

  const rowCells = (cells: PrintCell[], lo: number, hi: number, first: boolean) => {
    const out: React.ReactNode[] = [];
    let s = lo;
    for (const c of cells.filter((x) => x.start >= lo && x.start <= hi)) {
      for (; s < c.start; s++) out.push(<td key={`e${s}`} className={first ? "first" : ""} />);
      out.push(
        <td key={`c${c.start}`} colSpan={c.span} className={`pc ${c.category}${c.italic ? " it" : ""}${first ? " first" : ""}`}>
          {c.text.split("/").join(" / ")}
        </td>,
      );
      s = c.start + c.span;
    }
    for (; s <= hi; s++) out.push(<td key={`e${s}`} className={first ? "first" : ""} />);
    return out;
  };

  return (
    <div className="print-root">
      <div className="print-toolbar">
        <PrintButton />
        <a className="btn" href="/export/docx">
          Download Word (.docx)
        </a>
        <Link className="btn" href="/">
          Back to timetable
        </Link>
        <span className="hint">In the print dialog choose “Save as PDF”, Landscape, A4, and turn off headers and footers.</span>
      </div>

      <section className="sheet">
        <header className="p-title">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${CREST_PNG_BASE64}`} alt="University of Benin crest" />
          <div>
            <small>{T.university}</small>
            <h1>{T.faculty}</h1>
            <p>
              {data.semester?.name} {T.title}
            </p>
          </div>
          <div className="p-badge">
            <small>SESSION</small>
            <b>{data.semester?.session}</b>
            <small className="sem">{data.semester?.name.toUpperCase()}</small>
          </div>
        </header>

        <table className="p-grid">
          <colgroup>
            <col style={{ width: "6.3%" }} />
            <col style={{ width: "4.4%" }} />
            {Array.from({ length: 6 }, (_, i) => <col key={`a${i}`} style={{ width: "8.6%" }} />)}
            <col style={{ width: "3.3%" }} />
            {Array.from({ length: 4 }, (_, i) => <col key={`p${i}`} style={{ width: "8.6%" }} />)}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>VENUE</th>
              <th rowSpan={2}>DAY</th>
              <th colSpan={6}>MORNING · a.m.</th>
              <th rowSpan={2} className="brk">
                BREAK
                <br />
                2–2:30
              </th>
              <th colSpan={4}>AFTERNOON · p.m.</th>
            </tr>
            <tr className="times">
              {SLOTS.map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {venues.flatMap((pv) =>
              pv.rows.map((row, di) => {
                const first = di === 0;
                return (
                  <tr key={`${pv.venue.code}-${row.day}`}>
                    {first && (
                      <td rowSpan={pv.rows.length} className="v first">
                        <b>{pv.venue.code}</b>
                        <small>{pv.venue.seats} seats</small>
                      </td>
                    )}
                    <td className={`d${first ? " first" : ""}`}>{DAYS[row.day]}</td>
                    {rowCells(row.cells, 0, 5, first)}
                    {first && (
                      <td rowSpan={pv.rows.length} className="b first">
                        <span>BREAK</span>
                      </td>
                    )}
                    {rowCells(row.cells, 6, 9, first)}
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>

        <div className="p-legend">
          <b>KEY</b>
          <span><i className="comp" />Faculty of Computing courses</span>
          <span><i className="sci" />Mathematics &amp; Science courses</span>
          <span><i className="gen" />General / University courses (GST, ENT, CED)</span>
          <span><i className="act" />Tutorials &amp; Practicals</span>
          <span><i className="pt" />Part-time (PT) &amp; Jumat periods</span>
        </div>
      </section>

      <section className="sheet page2">
        <div className="two">
          <div>
            <h2>NOTE THE FOLLOWING</h2>
            <ol className="notes">
              {T.notes.map((n, i) => (
                <li key={i}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {n}
                </li>
              ))}
            </ol>
            <p>
              <b className="tl">PT</b> {T.ptNote}
            </p>
          </div>
          <div>
            <h2>KEY TO VENUE ALLOCATION</h2>
            <table className="key">
              <thead>
                <tr>
                  <th>CODE</th>
                  <th>VENUE</th>
                  <th>SEATS</th>
                </tr>
              </thead>
              <tbody>
                {data.venues.map((v) => (
                  <tr key={v.code}>
                    <td className="tl">
                      <b>{v.code}</b>
                    </td>
                    <td>{v.name}</td>
                    <td className="seats">{v.seats}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <h2>DISTRIBUTION</h2>
        <div className="two dist">
          <div>
            <p>
              <b>{T.distributionTo}</b>
            </p>
            <p className="tl cc">cc:</p>
            <ul>{T.ccLeft.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
          <div>
            <p>&nbsp;</p>
            <p className="tl cc">cc:</p>
            <ul>{T.ccRight.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        </div>

        <div className="sign">
          <p className="signed">Signed ({signedDate()})</p>
          <p className="name">{T.signatory.name}</p>
          <p>{T.signatory.role}</p>
          <p className="for">{T.signatory.forWhom}</p>
        </div>
      </section>
    </div>
  );
}
