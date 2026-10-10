import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProgrammeBoard, getProgrammeRow, programmeSignoff } from "@/lib/programme-data";
import { canManageProgrammeTimetable } from "@/lib/permissions";
import { PROGRAMMES, isProgramme } from "@/lib/programmes";
import { semesterNumber } from "@/lib/programme";
import { DEPARTMENTS } from "@/lib/timetable";
import { formatSignedDate } from "@/lib/signoff";
import { ProgrammeBoard } from "@/components/programmes/ProgrammeBoard";
import { CourseAllocation } from "@/components/programmes/CourseAllocation";
import { ProgrammeSetup } from "@/components/programmes/ProgrammeSetup";
import { SignoffPanel } from "@/components/SignoffPanel";
import { clearProgrammeSignoff, saveProgrammeSignoff } from "@/app/programme-actions";

export const metadata = { title: "Lecture timetable — Faculty of Computing" };

type Tab = "board" | "courses" | "setup" | "sign";

export default async function ProgrammePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab: raw }, me] = await Promise.all([params, searchParams, requireUser()]);
  const data = Number.isInteger(Number(id)) ? await getProgrammeBoard(Number(id)) : null;
  if (!data) notFound();
  const t = data.timetable;
  const manage = canManageProgrammeTimetable(me, t);
  const tab: Tab = raw === "courses" || raw === "setup" || raw === "sign" ? raw : "board";
  const name = `${isProgramme(t.programme) ? PROGRAMMES[t.programme].label : t.programme} · ${DEPARTMENTS[t.dept] ?? t.dept}`;
  const base = `/programmes/${t.id}`;

  let body: React.ReactNode;
  if (tab === "courses") body = <CourseAllocation data={data} canManage={manage} semester={semesterNumber(data.semester.name)} />;
  else if (tab === "setup" && manage) body = <ProgrammeSetup t={t} />;
  else if (tab === "sign") {
    const row = (await getProgrammeRow(t.id))!;
    body = manage ? (
      <SignoffPanel
        initial={programmeSignoff(row)}
        semesterLabel={`${name}, ${data.semester.session} ${data.semester.name}`}
        signatory={{ name: t.signatoryName || "—", role: t.signatoryRole }}
        onSave={saveProgrammeSignoff.bind(null, t.id)}
        onClear={clearProgrammeSignoff.bind(null, t.id)}
      />
    ) : (
      <section className="card narrow signoff">
        <h2>Sign-off</h2>
        <p className={`status ${t.signedOn ? "on" : "off"}`}>{t.signedOn ? `Signed ${formatSignedDate(t.signedOn)}` : "Not signed yet"}</p>
      </section>
    );
  } else body = <ProgrammeBoard data={data} canManage={manage} />;

  return (
    <>
      <div className="xhead">
        <Link href="/programmes">← All part-time &amp; postgraduate timetables</Link>
        <h2>{name}</h2>
        <span className="hint">
          {data.semester.session} {data.semester.name}
        </span>
        <span className={`pill ${t.isPublished ? "ok" : "warn"}`}>{t.isPublished ? "Published" : "Draft"}</span>
        {t.signedOn && <span className="pill ok">Signed {formatSignedDate(t.signedOn)}</span>}
      </div>
      <p className="hint" style={{ marginTop: -6 }}>
        {t.title}
      </p>
      <nav className="subtabs" aria-label="Lecture timetable">
        <Link className={`btn${tab === "board" ? " on" : ""}`} href={base}>
          Timetable
        </Link>
        <Link className={`btn${tab === "courses" ? " on" : ""}`} href={`${base}?tab=courses`}>
          Course allocation ({data.courses.length})
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
        <a className="btn" href={`/export/programme/${t.id}`}>
          Download Word
        </a>
        <a className="btn" href={`${base}/print`}>
          Print / PDF
        </a>
      </nav>
      {body}
    </>
  );
}
