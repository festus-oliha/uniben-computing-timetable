import { getSignoff, getTimetableData } from "@/lib/data";
import { requireUser } from "@/lib/auth/session";
import { canSignOff } from "@/lib/permissions";
import { formatSignedDate } from "@/lib/signoff";
import { DOCUMENT_TEXT } from "@/lib/export/document-text";
import { SignoffPanel } from "@/components/SignoffPanel";

export const metadata = { title: "Sign-off — Faculty of Computing Timetable" };

export default async function SignPage() {
  const [me, data, signoff] = await Promise.all([requireUser(), getTimetableData(), getSignoff()]);
  const label = data.semester ? `${data.semester.session} ${data.semester.name}` : "No semester";

  if (!canSignOff(me)) {
    return (
      <section className="card narrow signoff">
        <h2>Sign-off · {label}</h2>
        <p className={`status ${signoff.signedOn ? "on" : "off"}`}>
          {signoff.signedOn ? `Signed ${formatSignedDate(signoff.signedOn)} by the Faculty Time-Table Officer` : "Not signed yet"}
        </p>
        <p className="hint">Only the Faculty Time-Table Officer can sign off the timetable.</p>
      </section>
    );
  }

  return (
    <SignoffPanel
      initial={signoff}
      semesterLabel={label}
      signatory={{ name: DOCUMENT_TEXT.signatory.name, role: DOCUMENT_TEXT.signatory.role }}
    />
  );
}
