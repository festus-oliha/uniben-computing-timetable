import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/permissions";
import { DEPARTMENTS } from "@/lib/timetable";
import { ChangePasswordForm } from "@/components/AuthForms";

export const metadata = { title: "Your account — FaCoMS Timetable" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const me = await requireUser();
  const { first } = await searchParams;
  return (
    <section className="card narrow">
      <h2>Your account</h2>
      {(first || me.mustChangePassword) && (
        <p className="readonly-note">You&apos;re using a temporary password. Choose your own password now.</p>
      )}
      <p>
        <b>{me.name}</b> · {me.email}
        <br />
        <span className="hint">
          {ROLE_LABELS[me.role]}
          {me.dept ? ` · ${DEPARTMENTS[me.dept] ?? me.dept}` : ""}
        </span>
      </p>
      <ChangePasswordForm />
    </section>
  );
}
