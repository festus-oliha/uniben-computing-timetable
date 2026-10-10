import { getProgrammeBoard, getProgrammeRow, programmeSignoff } from "@/lib/programme-data";
import { buildProgrammeDoc } from "@/lib/export/programme-layout";
import { buildProgrammeDocx } from "@/lib/export/programme-docx";
import { getCurrentUser } from "@/lib/auth/session";
import { PROGRAMMES, isProgramme } from "@/lib/programmes";

export const dynamic = "force-dynamic";

/** GET /export/programme/:id — a part-time / postgraduate lecture timetable as Word. Staff any time; everyone once published. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = Number.isInteger(Number(id)) ? await getProgrammeRow(Number(id)) : null;
  if (!row) return new Response("Not found", { status: 404 });
  if (!row.isPublished && !(await getCurrentUser())) return Response.redirect(new URL(`/login?next=/export/programme/${id}`, req.url), 303);
  const data = (await getProgrammeBoard(row.id))!;
  const buf = await buildProgrammeDocx(buildProgrammeDoc(data.timetable, data.slots, data.courses, data.lecturers), programmeSignoff(row));
  const prog = isProgramme(row.programme) ? PROGRAMMES[row.programme].short.replace(/\W+/g, "") : row.programme;
  const name = `${row.dept}_${prog}_${data.semester.name.replace(/\s+/g, "_")}_Lecture_Timetable_${data.semester.session.replace("/", "-")}.docx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
