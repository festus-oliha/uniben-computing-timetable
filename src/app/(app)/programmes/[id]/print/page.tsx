import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgrammeBoard, getProgrammeRow, programmeSignoff } from "@/lib/programme-data";
import { buildProgrammeDoc } from "@/lib/export/programme-layout";
import { ProgrammeSheet } from "@/components/programmes/ProgrammeSheet";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Print lecture timetable — FaCoMS" };

export default async function ProgrammePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = Number.isInteger(Number(id)) ? await getProgrammeBoard(Number(id)) : null;
  if (!data) notFound();
  const signoff = programmeSignoff((await getProgrammeRow(data.timetable.id))!);
  const doc = buildProgrammeDoc(data.timetable, data.slots, data.courses, data.lecturers);
  return (
    <div className={`pp-root ${doc.landscape ? "land" : "port"}`}>
      <div className="print-toolbar">
        <PrintButton />
        <a className="btn" href={`/export/programme/${data.timetable.id}`}>
          Download Word (.docx)
        </a>
        <Link className="btn" href={`/programmes/${data.timetable.id}`}>
          Back to the timetable
        </Link>
        <span className="hint">In the print dialog choose “Save as PDF”, {doc.landscape ? "Landscape" : "Portrait"}, A4, and turn off headers and footers.</span>
      </div>
      <ProgrammeSheet doc={doc} signoff={signoff} />
    </div>
  );
}
