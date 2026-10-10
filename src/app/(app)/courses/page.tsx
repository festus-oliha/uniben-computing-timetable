import { getTimetableData } from "@/lib/data";
import { requireUser } from "@/lib/auth/session";
import { CoursesTable } from "@/components/CoursesTable";

export default async function CoursesPage() {
  const [me, data] = await Promise.all([requireUser(), getTimetableData()]);
  return <CoursesTable data={data} actor={{ role: me.role, dept: me.dept }} />;
}
