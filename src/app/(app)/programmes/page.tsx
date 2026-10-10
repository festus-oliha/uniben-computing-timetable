import { requireUser } from "@/lib/auth/session";
import { getCurrentSemester } from "@/lib/data";
import { listProgrammeTimetables } from "@/lib/programme-data";
import { ProgrammeList } from "@/components/programmes/ProgrammeList";

export const metadata = { title: "Part-time & postgraduate — Faculty of Computing Timetable" };

export default async function ProgrammesPage() {
  const [me, sem] = await Promise.all([requireUser(), getCurrentSemester()]);
  if (!sem) return <div className="card empty">No semester has been set up yet.</div>;
  const all = await listProgrammeTimetables();
  return (
    <ProgrammeList
      semester={{ id: sem.id, label: `${sem.session} ${sem.name}` }}
      current={all.filter((t) => t.semesterId === sem.id)}
      earlier={all.filter((t) => t.semesterId !== sem.id)}
      actor={{ role: me.role, dept: me.dept }}
    />
  );
}
