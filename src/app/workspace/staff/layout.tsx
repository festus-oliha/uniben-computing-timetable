import { redirect } from "next/navigation";
import { countUsers, getCurrentUser } from "@/lib/auth/session";
import { WorkspaceHeader } from "@/components/brand/WorkspaceHeader";
import { Credit } from "@/components/brand/SiteChrome";
import { StaffNav } from "@/components/staff/StaffNav";

export default async function StaffWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect((await countUsers()) === 0 ? "/setup" : "/login?next=/workspace/staff");
  return (
    <>
      <WorkspaceHeader module="Staff" me={me} />
      <StaffNav canEdit={me.role !== "viewer"} />
      <main>{children}</main>
      <footer className="ws-foot">
        <a href="/">FaCoMS</a> — Faculty of Computing, University of Benin. <Credit />
      </footer>
    </>
  );
}
