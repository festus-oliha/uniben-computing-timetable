import { redirect } from "next/navigation";
import { countUsers } from "@/lib/auth/session";
import { AuthShell } from "@/components/AuthShell";
import { SetupForm } from "@/components/AuthForms";

export const metadata = { title: "First-time setup — Faculty of Computing Timetable" };

/** Shown only until the first account exists. That account is the Faculty Time-Table Officer (admin). */
export default async function SetupPage() {
  if ((await countUsers()) > 0) redirect("/login");
  return (
    <AuthShell title="First-time setup">
      <p className="hint">
        Create the <b>Faculty Time-Table Officer</b> account. This account can edit everything, sign off the timetable and
        create accounts for department officers and viewers.
      </p>
      <SetupForm />
    </AuthShell>
  );
}
