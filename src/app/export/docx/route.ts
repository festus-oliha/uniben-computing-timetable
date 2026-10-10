import { getTimetableData } from "@/lib/data";
import { buildTimetableDocx } from "@/lib/export/docx";

export const dynamic = "force-dynamic";

/** GET /export/docx — the official timetable as a Word file, built from the current data. */
export async function GET() {
  const data = await getTimetableData();
  const buf = await buildTimetableDocx(data);
  const name = data.semester
    ? `Faculty_of_Computing_${data.semester.name.replace(/\s+/g, "_")}_Timetable_${data.semester.session.replace("/", "-")}.docx`
    : "Faculty_of_Computing_Timetable.docx";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
