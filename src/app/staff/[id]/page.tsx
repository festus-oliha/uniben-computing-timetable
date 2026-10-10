import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getStaffRow, teachingOf, toPublicStaff } from "@/lib/staff-data";
import { CATEGORIES, initials, type StaffCategory } from "@/lib/staff";
import { DEPARTMENTS } from "@/lib/timetable";
import { paragraphs } from "@/lib/home-content";
import { ModuleHeader, SiteFooter } from "@/components/brand/SiteChrome";
import "../staff.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await getStaffRow(id);
  return { title: l?.isActive ? `${l.name} — FaCoMS Staff` : "Staff — FaCoMS" };
}

/** A staff member's public profile. Contact details appear only for signed-in staff. */
export default async function StaffProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row, me] = await Promise.all([getStaffRow(id), getCurrentUser()]);
  if (!row || (!row.isActive && !me)) notFound();
  const s = toPublicStaff(row);
  const teaching = await teachingOf(id);

  return (
    <div className="sd">
      <ModuleHeader module="Staff Members" signedIn={!!me} />
      <main className="sp">
        <p className="sp-back">
          <Link href={s.dept ? `/staff?dept=${s.dept}` : "/staff"}>All {s.dept ? DEPARTMENTS[s.dept] : ""} staff</Link>
        </p>
        <article className="sp-card">
          <div className="sp-photo">
            {s.photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={s.photoUrl} alt={s.name} />
            ) : (
              <span className="sd-ini big">{initials(s.name)}</span>
            )}
          </div>
          <div className="sp-text">
            <h1>{s.name}</h1>
            <p className="sp-rank">
              {[s.rank || CATEGORIES[s.category as StaffCategory]?.label, s.dept ? `Department of ${DEPARTMENTS[s.dept]}` : "Faculty of Computing"].join(", ")}
            </p>
            {s.position && <p className="sp-pos">{s.position}</p>}
            {!row.isActive && <p className="pill warn">No longer on the staff list</p>}
            <dl>
              {s.qualifications && (
                <>
                  <dt>Qualifications</dt>
                  <dd>{s.qualifications}</dd>
                </>
              )}
              {s.interests && (
                <>
                  <dt>Research interests</dt>
                  <dd>{s.interests}</dd>
                </>
              )}
              {teaching.length > 0 && (
                <>
                  <dt>Teaching this semester</dt>
                  <dd>
                    {teaching.map((t) => (
                      <span key={t.code} className="sp-course">
                        <b>{t.code}</b> {t.title}
                      </span>
                    ))}
                  </dd>
                </>
              )}
              {me && (row.email || row.phone || row.office) && (
                <>
                  <dt>Contact (staff only)</dt>
                  <dd>
                    {row.email && <a href={`mailto:${row.email}`}>{row.email}</a>}
                    {row.phone && <span>{row.phone}</span>}
                    {row.office && <span>{row.office}</span>}
                  </dd>
                </>
              )}
            </dl>
            {paragraphs(s.bio).map((p, i) => (
              <p key={i} className="sp-bio">
                {p}
              </p>
            ))}
            {me && (
              <p>
                <Link className="tt-btn" href={`/workspace/staff/${s.id}`}>
                  Edit in the staff workspace
                </Link>
              </p>
            )}
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
