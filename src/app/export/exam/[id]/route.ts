import { examSignoff, getExamBoard, getExamRow } from "@/lib/exam-data";
import { buildExamDoc } from "@/lib/export/exam-layout";
import { buildExamDocx } from "@/lib/export/exam-docx";
import { getCurrentUser } from "@/lib/auth/session";
import { PROGRAMMES, isProgramme } from "@/lib/programmes";

export const dynamic = "force-dynamic";

/** GET /export/exam/:id — an examination timetable as a Word file. Staff any time; everyone once it is published. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = Number.isInteger(Number(id)) ? await getExamRow(Number(id)) : null;
  if (!row) return new Response("Not found", { status: 404 });
  if (!row.isPublished && !(await getCurrentUser())) return Response.redirect(new URL(`/login?next=/export/exam/${id}`, req.url), 303);
  const data = (await getExamBoard(row.id))!;
  const buf = await buildExamDocx(buildExamDoc(data.timetable, data.papers, data.venues), examSignoff(row));
  const prog = isProgramme(row.programme) ? PROGRAMMES[row.programme].short.replace(/\W+/g, "") : row.programme;
  const name = `Faculty_of_Computing_${prog}${row.dept ? `_${row.dept}` : ""}_${data.semester.name.replace(/\s+/g, "_")}_Exam_Timetable_${data.semester.session.replace("/", "-")}.docx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
