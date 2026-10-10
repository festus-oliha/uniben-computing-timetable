import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { examSignoff, getExamBoard, getExamRow, invigilationSignoff } from "@/lib/exam-data";
import { canManageExamTimetable } from "@/lib/permissions";
import { PROGRAMMES, isProgramme } from "@/lib/programmes";
import { DEPARTMENTS } from "@/lib/timetable";
import { formatSignedDate } from "@/lib/signoff";
import { ExamBoard } from "@/components/exams/ExamBoard";
import { ExamSetup } from "@/components/exams/ExamSetup";
import { SignoffPanel } from "@/components/SignoffPanel";
import { clearExamSignoff, saveExamSignoff } from "@/app/exam-actions";
import { clearInvigilationSignoff, saveInvigilationSignoff } from "@/app/invigilation-actions";
import { InvigilationBoard } from "@/components/exams/InvigilationBoard";

export const metadata = { title: "Examination timetable — Faculty of Computing" };

type Tab = "board" | "invigilation" | "setup" | "sign";

export default async function ExamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab: rawTab }, me] = await Promise.all([params, searchParams, requireUser()]);
  const data = Number.isInteger(Number(id)) ? await getExamBoard(Number(id)) : null;
  if (!data) notFound();
  const t = data.timetable;
  const manage = canManageExamTimetable(me, t);
  const tab: Tab = rawTab === "setup" || rawTab === "sign" || rawTab === "invigilation" ? rawTab : "board";
  const name = `${isProgramme(t.programme) ? PROGRAMMES[t.programme].label : t.programme}${t.dept ? ` · ${DEPARTMENTS[t.dept] ?? t.dept}` : ""}`;
  const base = `/exams/${t.id}`;

  let body: React.ReactNode;
  if (tab === "setup" && manage) {
    body = <ExamSetup t={t} usedDates={[...new Set(data.papers.map((p) => p.date))]} />;
  } else if (tab === "invigilation") {
    body = <InvigilationBoard data={data} canManage={manage} />;
  } else if (tab === "sign") {
    const row = (await getExamRow(t.id))!;
    body = manage ? (
      <>
        <SignoffPanel
          heading="Examination timetable sign-off"
          initial={examSignoff(row)}
          semesterLabel={name}
          signatory={{ name: t.signatoryName || "—", role: t.signatoryRole }}
          onSave={saveExamSignoff.bind(null, t.id)}
          onClear={clearExamSignoff.bind(null, t.id)}
        />
        <SignoffPanel
          heading="Invigilation schedule sign-off"
          idPrefix="inv-"
          initial={invigilationSignoff(row)}
          semesterLabel={name}
          signatory={{ name: t.signatoryName || "—", role: t.signatoryRole }}
          onSave={saveInvigilationSignoff.bind(null, t.id)}
          onClear={clearInvigilationSignoff.bind(null, t.id)}
        />
      </>
    ) : (
      <section className="card narrow signoff">
        <h2>Sign-off</h2>
        <p className={`status ${t.signedOn ? "on" : "off"}`}>Examination timetable: {t.signedOn ? `signed ${formatSignedDate(t.signedOn)}` : "not signed yet"}</p>
        <p className={`status ${t.invSignedOn ? "on" : "off"}`}>Invigilation schedule: {t.invSignedOn ? `signed ${formatSignedDate(t.invSignedOn)}` : "not signed yet"}</p>
      </section>
    );
  } else {
    body = <ExamBoard data={data} actor={{ role: me.role, dept: me.dept }} />;
  }

  return (
    <>
      <div className="xhead">
        <Link href="/exams">← All examination timetables</Link>
        <h2>{name}</h2>
        <span className={`pill ${t.isPublished ? "ok" : "warn"}`}>{t.isPublished ? "Published" : "Draft"}</span>
        {t.signedOn && <span className="pill ok">Signed {formatSignedDate(t.signedOn)}</span>}
      </div>
      <p className="hint" style={{ marginTop: -6 }}>{t.title}</p>
      <nav className="subtabs" aria-label="Examination timetable">
        <Link className={`btn${tab === "board" ? " on" : ""}`} href={base}>
          Timetable
        </Link>
        <Link className={`btn${tab === "invigilation" ? " on" : ""}`} href={`${base}?tab=invigilation`}>
          Invigilation
        </Link>
        {manage && (
          <Link className={`btn${tab === "setup" ? " on" : ""}`} href={`${base}?tab=setup`}>
            Set-up &amp; publish
          </Link>
        )}
        <Link className={`btn${tab === "sign" ? " on" : ""}`} href={`${base}?tab=sign`}>
          Sign-off
        </Link>
        <span className="grow" />
        {tab !== "invigilation" && (
          <>
            <a className="btn" href={`/export/exam/${t.id}`}>
              Download Word
            </a>
            <a className="btn" href={`/exams/${t.id}/print`}>
              Print / PDF
            </a>
          </>
        )}
      </nav>
      {body}
    </>
  );
}
