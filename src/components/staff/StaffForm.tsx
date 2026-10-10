"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStaff, saveStaffPhoto, type StaffInput } from "@/app/staff-actions";
import { CATEGORIES, RANKS, initials, type StaffCategory } from "@/lib/staff";
import { printName } from "@/lib/invigilation";
import { FACULTY_DEPARTMENTS } from "@/lib/site-content";
import { resizePhoto } from "@/lib/client-image";
import type { StaffDTO, TeachingDTO } from "@/lib/types";
import { useToast } from "../Toast";

const blank: StaffInput = { name: "", shortName: "", category: "academic", rank: "", position: "", dept: null, qualifications: "", interests: "", bio: "", staffNo: "", email: "", phone: "", office: "", isActive: true };

/** Add or edit one staff record (and its photo). */
export function StaffForm({ staff, teaching = [], canEdit, lockedDept }: { staff?: StaffDTO; teaching?: TeachingDTO[]; canEdit: boolean; lockedDept: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState<StaffInput>(staff ? { ...staff, shortName: staff.shortName ?? "" } : { ...blank, dept: lockedDept });
  const [photo, setPhoto] = useState(staff?.photoUrl ?? null);
  const set = <K extends keyof StaffInput>(k: K, x: StaffInput[K]) => setV((s) => ({ ...s, [k]: x }));
  const cat = v.category as StaffCategory;

  function save() {
    startTransition(async () => {
      const r = await saveStaff({ ...v, id: staff?.id });
      toast(r.ok ? r.message ?? "Saved." : r.error, !r.ok);
      if (r.ok && !staff && r.id) router.push(`/workspace/staff/${r.id}`);
      else if (r.ok) router.refresh();
    });
  }

  async function pick(f: File | undefined) {
    if (!f || !staff) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return toast("Choose a JPEG or PNG photo.", true);
    let data: string;
    try {
      data = await resizePhoto(f, 400);
    } catch {
      return toast("That photo couldn't be read. Try another file.", true);
    }
    startTransition(async () => {
      const r = await saveStaffPhoto(staff.id, data);
      toast(r.ok ? r.message ?? "Saved." : r.error, !r.ok);
      if (r.ok) {
        setPhoto(data);
        router.refresh();
      }
    });
  }

  function removePhoto() {
    if (!staff) return;
    startTransition(async () => {
      const r = await saveStaffPhoto(staff.id, null);
      toast(r.ok ? r.message ?? "Removed." : r.error, !r.ok);
      if (r.ok) {
        setPhoto(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="staff-form">
      <aside className="card sf-photo">
        {photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={photo} alt={v.name} />
        ) : (
          <div className="sf-ini">{initials(v.name) || "?"}</div>
        )}
        {canEdit && staff && (
          <>
            <label className="btn">
              {photo ? "Change photo" : "Add photo"}
              <input id="staff-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            {photo && (
              <button type="button" className="btn" onClick={removePhoto} disabled={pending}>
                Remove photo
              </button>
            )}
          </>
        )}
        {!staff && <p className="hint">Save the record first, then add a photo.</p>}
        {staff && (
          <p className="hint">
            <Link href={`/staff/${staff.id}`} target="_blank">
              See the public profile
            </Link>
          </p>
        )}
      </aside>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <fieldset disabled={!canEdit} className="plain">
          <h2>{staff ? staff.name : "Add a person"}</h2>
          <div className="row2">
            <label className="fld">
              <span>Full name with title</span>
              <input id="staff-name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Prof. (Mrs.) S. Konyeha" required />
            </label>
            <label className="fld">
              <span>Department</span>
              <select id="staff-dept" value={v.dept ?? ""} onChange={(e) => set("dept", e.target.value || null)} disabled={!!lockedDept}>
                <option value="">— Faculty office / none —</option>
                {FACULTY_DEPARTMENTS.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row2">
            <label className="fld">
              <span>Category</span>
              <select id="staff-category" value={v.category} onChange={(e) => set("category", e.target.value)}>
                {(Object.keys(CATEGORIES) as StaffCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIES[c].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="fld">
              <span>Rank / designation</span>
              <input id="staff-rank" value={v.rank} onChange={(e) => set("rank", e.target.value)} list="rank-list" placeholder={RANKS[cat]?.[0]} />
              <datalist id="rank-list">
                {(RANKS[cat] ?? []).map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="row2">
            <label className="fld">
              <span>Position held (optional)</span>
              <input id="staff-position" value={v.position} onChange={(e) => set("position", e.target.value)} placeholder="Head of Department" />
            </label>
            <label className="fld">
              <span>Print name on schedules</span>
              <input id="staff-short" value={v.shortName} onChange={(e) => set("shortName", e.target.value)} placeholder={printName({ name: v.name || "Surname" })} />
            </label>
          </div>
          <label className="fld">
            <span>Qualifications</span>
            <input id="staff-qual" value={v.qualifications} onChange={(e) => set("qualifications", e.target.value)} placeholder="B.Sc., M.Sc., Ph.D. (Benin)" />
          </label>
          <label className="fld">
            <span>Research interests / specialisation</span>
            <input id="staff-interests" value={v.interests} onChange={(e) => set("interests", e.target.value)} placeholder="Machine learning, health informatics" />
          </label>
          <label className="fld">
            <span>Short profile</span>
            <textarea id="staff-bio" rows={4} value={v.bio} onChange={(e) => set("bio", e.target.value)} />
          </label>

          <h3 className="sub">Staff-only details (never shown publicly)</h3>
          <div className="row2">
            <label className="fld">
              <span>Official email</span>
              <input id="staff-email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} placeholder="name@uniben.edu" />
            </label>
            <label className="fld">
              <span>Phone</span>
              <input id="staff-phone" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
            </label>
          </div>
          <div className="row2">
            <label className="fld">
              <span>Staff number</span>
              <input id="staff-no" value={v.staffNo} onChange={(e) => set("staffNo", e.target.value)} />
            </label>
            <label className="fld">
              <span>Office</span>
              <input id="staff-office" value={v.office} onChange={(e) => set("office", e.target.value)} />
            </label>
          </div>
          {staff && (
            <label className="toggle-row">
              <input type="checkbox" checked={!v.isActive} onChange={(e) => set("isActive", !e.target.checked)} /> Has left the Faculty (hide from the directory, keep the record)
            </label>
          )}
          {canEdit && (
            <div className="actions" style={{ padding: 0 }}>
              <button className="btn primary" disabled={pending}>
                {pending ? "Saving…" : staff ? "Save changes" : "Add to the staff list"}
              </button>
              <Link className="btn" href="/workspace/staff">
                Back to the list
              </Link>
            </div>
          )}
        </fieldset>
        {staff && (
          <>
            <h3 className="sub">Teaching this semester</h3>
            {teaching.length ? (
              <ul className="teach">
                {teaching.map((t) => (
                  <li key={t.code}>
                    <b>{t.code}</b> {t.title} <span className="hint">({t.where})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint">No courses assigned. Courses are assigned on the timetable workspace&apos;s Courses tab and in part-time / postgraduate course allocations.</p>
            )}
          </>
        )}
      </form>
    </div>
  );
}
