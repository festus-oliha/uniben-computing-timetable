import { getSignoff, getTimetableData } from "@/lib/data";
import { DOCUMENT_TEXT } from "@/lib/export/document-text";
import { SignoffPanel } from "@/components/SignoffPanel";

export const metadata = { title: "Sign-off — Faculty of Computing Timetable" };

export default async function SignPage() {
  const [data, signoff] = await Promise.all([getTimetableData(), getSignoff()]);
  const label = data.semester ? `${data.semester.session} ${data.semester.name}` : "No semester";
  return (
    <SignoffPanel
      initial={signoff}
      semesterLabel={label}
      signatory={{ name: DOCUMENT_TEXT.signatory.name, role: DOCUMENT_TEXT.signatory.role }}
    />
  );
}
