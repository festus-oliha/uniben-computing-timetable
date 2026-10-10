import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getStaffRow, teachingOf, toStaff } from "@/lib/staff-data";
import { canManageLecturer } from "@/lib/permissions";
import { StaffForm } from "@/components/staff/StaffForm";

export const metadata = { title: "Staff record — FaCoMS" };

export default async function StaffRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, me] = await Promise.all([params, requireUser()]);
  const row = await getStaffRow(id);
  if (!row) notFound();
  return <StaffForm staff={toStaff(row)} teaching={await teachingOf(id)} canEdit={canManageLecturer(me, row)} lockedDept={me.role === "dept_officer" ? me.dept : null} />;
}
