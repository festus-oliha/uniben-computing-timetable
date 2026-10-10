import { getTimetableData } from "@/lib/data";
import { requireUser } from "@/lib/auth/session";
import { LecturersPanel } from "@/components/LecturersPanel";

export default async function LecturersPage() {
  const [me, data] = await Promise.all([requireUser(), getTimetableData()]);
  return <LecturersPanel data={data} actor={{ role: me.role, dept: me.dept }} />;
}
