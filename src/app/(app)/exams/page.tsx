import { requireUser } from "@/lib/auth/session";
import { getCurrentSemester } from "@/lib/data";
import { listExamTimetables } from "@/lib/exam-data";
import { ExamList } from "@/components/exams/ExamList";

export const metadata = { title: "Examinations — Faculty of Computing Timetable" };

export default async function ExamsPage() {
  const [me, sem] = await Promise.all([requireUser(), getCurrentSemester()]);
  if (!sem) return <div className="card empty">No semester has been set up yet.</div>;
  const list = await listExamTimetables(sem.id);
  return <ExamList semester={{ id: sem.id, label: `${sem.session} ${sem.name}` }} timetables={list} actor={{ role: me.role, dept: me.dept }} />;
}
