import { requireUser } from "@/lib/auth/session";
import { listStaffRows, toStaff } from "@/lib/staff-data";
import { StaffList } from "@/components/staff/StaffList";

export const metadata = { title: "Staff list — FaCoMS" };

export default async function StaffWorkspacePage() {
  const [me, rows] = await Promise.all([requireUser(), listStaffRows()]);
  return <StaffList staff={rows.map(toStaff)} actor={{ role: me.role, dept: me.dept }} />;
}
