import { redirect } from "next/navigation";
import { countUsers, getCurrentUser } from "@/lib/auth/session";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/AuthForms";

export const metadata = { title: "Sign in — Faculty of Computing Timetable" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if ((await countUsers()) === 0) redirect("/setup");
  if (await getCurrentUser()) redirect("/timetable");
  const { next } = await searchParams;
  return (
    <AuthShell title="Timetable sign in">
      <LoginForm next={next ?? "/timetable"} />
      <p className="hint">No account yet? Ask the Faculty Time-Table Officer to create one for you.</p>
      <p className="hint">
        Students and lecturers: <a href="/view">see the published timetable</a> — no sign-in needed.
      </p>
    </AuthShell>
  );
}
