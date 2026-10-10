import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { StaffImport } from "@/components/staff/StaffImport";

export const metadata = { title: "Load a staff list — FaCoMS" };

export default async function StaffImportPage() {
  const me = await requireUser();
  if (me.role === "viewer") redirect("/workspace/staff");
  return <StaffImport deptOfficer={me.role === "dept_officer" ? me.dept : null} />;
}
