import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { StaffForm } from "@/components/staff/StaffForm";

export const metadata = { title: "Add a person — FaCoMS" };

export default async function NewStaffPage() {
  const me = await requireUser();
  if (me.role === "viewer") redirect("/workspace/staff");
  return <StaffForm canEdit lockedDept={me.role === "dept_officer" ? me.dept : null} />;
}
