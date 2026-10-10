import { getExamBoard, getExamRow, invigilationSignoff } from "@/lib/exam-data";
import { buildInvigilationDoc } from "@/lib/export/invigilation-layout";
import { buildInvigilationDocx } from "@/lib/export/invigilation-docx";
import { getCurrentUser } from "@/lib/auth/session";
import { PROGRAMMES, isProgramme } from "@/lib/programmes";

export const dynamic = "force-dynamic";

/** GET /export/invigilation/:id — the invigilation schedule as a Word file. Staff any time; everyone once it is published. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = Number.isInteger(Number(id)) ? await getExamRow(Number(id)) : null;
  if (!row) return new Response("Not found", { status: 404 });
  if (!row.invigilationPublished && !(await getCurrentUser())) return Response.redirect(new URL(`/login?next=/export/invigilation/${id}`, req.url), 303);
  const data = (await getExamBoard(row.id))!;
  const buf = await buildInvigilationDocx(buildInvigilationDoc(data.timetable, data.papers, data.lecturers, data.venues), invigilationSignoff(row));
  const prog = isProgramme(row.programme) ? PROGRAMMES[row.programme].short.replace(/\W+/g, "") : row.programme;
  const name = `Faculty_of_Computing_${prog}${row.dept ? `_${row.dept}` : ""}_${data.semester.name.replace(/\s+/g, "_")}_Invigilation_${data.semester.session.replace("/", "-")}.docx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
