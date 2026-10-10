"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lecturers } from "@/lib/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { canManageLecturer, outsideDeptMessage } from "@/lib/permissions";
import { logChange } from "@/lib/audit";
import { CATEGORIES, normaliseRank, sameKey, staffProblem, type StaffCategory, type StaffDraft } from "@/lib/staff";
import { MAX_PHOTO_BYTES } from "@/lib/home-content";
import { FACULTY_DEPTS } from "@/lib/timetable";
import type { ActionResult } from "@/lib/types";

type Result = ActionResult & { id?: string };
const fail = (error: string): Result => ({ ok: false, error });
function done(message?: string, id?: string): Result {
  revalidatePath("/", "layout");
  return { ok: true, message, id };
}
async function guard(fn: (me: CurrentUser) => Promise<Result>): Promise<Result> {
  try {
    const me = await getCurrentUser();
    if (!me) return fail("Your session has ended. Sign in again.");
    return await fn(me);
  } catch (err) {
    console.error(err);
    return fail("The change could not be saved. Check the database connection and try again.");
  }
}

const validDept = (d: string | null) => d === null || (FACULTY_DEPTS as readonly string[]).includes(d);
const NOT_YOURS = "Only the Faculty Officer, or the officer of this person's department, can change their record.";

export interface StaffInput {
  id?: string;
  name: string;
  shortName: string;
  category: string;
  rank: string;
  position: string;
  dept: string | null;
  qualifications: string;
  interests: string;
  bio: string;
  staffNo: string;
  email: string;
  phone: string;
  office: string;
  isActive: boolean;
}

export async function saveStaff(input: StaffInput): Promise<Result> {
  return guard(async (me) => {
    const dept = me.role === "dept_officer" ? me.dept : input.dept || null;
    const v = {
      name: input.name.trim().replace(/\s+/g, " "),
      shortName: input.shortName.trim().toUpperCase().slice(0, 40) || null,
      category: input.category as StaffCategory,
      rank: normaliseRank(input.rank).slice(0, 80),
      position: input.position.trim().slice(0, 120),
      dept,
      qualifications: input.qualifications.trim().slice(0, 400),
      interests: input.interests.trim().slice(0, 600),
      bio: input.bio.trim().slice(0, 3000),
      staffNo: input.staffNo.trim().slice(0, 40),
      email: input.email.trim().toLowerCase().slice(0, 120),
      phone: input.phone.trim().slice(0, 20),
      office: input.office.trim().slice(0, 120),
      isActive: input.isActive,
      updatedAt: new Date(),
    };
    const bad = staffProblem(v);
    if (bad) return fail(bad);
    if (!validDept(dept)) return fail("Choose one of the Faculty's departments.");
    if (!canManageLecturer(me, { dept })) return fail(NOT_YOURS);
    if (input.id) {
      const [old] = await db.select().from(lecturers).where(eq(lecturers.id, input.id));
      if (!old) return fail("That record no longer exists.");
      if (!canManageLecturer(me, old)) return fail(NOT_YOURS);
      await db.update(lecturers).set(v).where(eq(lecturers.id, input.id));
      const what: string[] = [];
      for (const k of ["name", "rank", "position", "dept", "category"] as const) if ((old[k] ?? "") !== (v[k] ?? "")) what.push(`${k} ${old[k] || "—"} → ${v[k] || "—"}`);
      if (old.isActive !== v.isActive) what.push(v.isActive ? "back on the staff list" : "marked as left");
      const other = ["qualifications", "interests", "bio", "staffNo", "email", "phone", "office", "shortName"].filter((k) => (old as Record<string, unknown>)[k] !== (v as Record<string, unknown>)[k]);
      if (other.length) what.push("profile details");
      if (what.length) await logChange(me, "staff.edit", `${v.name}: ${what.join("; ")}.`);
      return done("Saved.", input.id);
    }
    const [row] = await db.insert(lecturers).values(v).returning({ id: lecturers.id });
    await logChange(me, "staff.add", `Added ${v.name}${v.rank ? `, ${v.rank}` : ""}${dept ? ` (${dept})` : ""} to the staff list.`);
    return done(`${v.name} added.`, row.id);
  });
}

const PHOTO_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;

export async function saveStaffPhoto(id: string, photo: string | null): Promise<Result> {
  return guard(async (me) => {
    const [l] = await db.select().from(lecturers).where(eq(lecturers.id, id));
    if (!l) return fail("That record no longer exists.");
    if (!canManageLecturer(me, l)) return fail(NOT_YOURS);
    if (photo && (!PHOTO_RE.test(photo) || photo.length > MAX_PHOTO_BYTES)) return fail("Use a JPEG or PNG photo under 600 KB.");
    await db.update(lecturers).set({ photo, updatedAt: new Date() }).where(eq(lecturers.id, id));
    await logChange(me, "staff.edit", `${l.name}: ${photo ? "photo updated" : "photo removed"}.`);
    return done(photo ? "Photo saved." : "Photo removed.");
  });
}

/**
 * Loads a staff list. People already on the list (same staff number, or the same name and initials) are updated —
 * only the cells that have something in them, so nothing typed in the app is wiped. Everyone else is added.
 */
export async function importStaff(rows: StaffDraft[]): Promise<Result & { added?: number; updated?: number; skipped?: string[] }> {
  return guard(async (me) => {
    if (!Array.isArray(rows) || !rows.length) return fail("There are no rows to load.");
    if (rows.length > 1000) return fail("Load at most 1,000 people at a time.");
    const existing = await db.select().from(lecturers);
    const byNo = new Map(existing.filter((l) => l.staffNo).map((l) => [l.staffNo.toLowerCase(), l]));
    const byName = new Map(existing.map((l) => [sameKey(l.name), l]));
    let added = 0;
    let updated = 0;
    const skipped: string[] = [];
    for (const r of rows) {
      const name = String(r.name ?? "").trim().replace(/\s+/g, " ");
      const category = (r.category in CATEGORIES ? r.category : "academic") as StaffCategory;
      const dept = me.role === "dept_officer" ? r.dept ?? me.dept : r.dept ?? null;
      const v = {
        rank: normaliseRank(String(r.rank ?? "")).slice(0, 80),
        position: String(r.position ?? "").trim().slice(0, 120),
        qualifications: String(r.qualifications ?? "").trim().slice(0, 400),
        interests: String(r.interests ?? "").trim().slice(0, 600),
        staffNo: String(r.staffNo ?? "").trim().slice(0, 40),
        email: String(r.email ?? "").trim().toLowerCase().slice(0, 120),
        phone: String(r.phone ?? "").trim().slice(0, 20),
        office: String(r.office ?? "").trim().slice(0, 120),
      };
      // A bad email or phone shouldn't keep the person out: load them without it and say so.
      if (v.email && staffProblem({ name: "x", email: v.email, phone: "", category })) {
        skipped.push(`${name}: loaded without the email "${v.email}" (doesn't look right)`);
        v.email = "";
      }
      if (v.phone && staffProblem({ name: "x", email: "", phone: v.phone, category })) {
        skipped.push(`${name}: loaded without the phone "${v.phone}"`);
        v.phone = "";
      }
      const bad = staffProblem({ name, email: v.email, phone: v.phone, category });
      if (bad) {
        skipped.push(`${name || "(no name)"}: ${bad}`);
        continue;
      }
      if (!validDept(dept)) {
        skipped.push(`${name}: department not recognised`);
        continue;
      }
      if (!canManageLecturer(me, { dept })) {
        skipped.push(`${name}: ${dept ?? "no"} department — ${outsideDeptMessage(me)}`);
        continue;
      }
      const match = (v.staffNo && byNo.get(v.staffNo.toLowerCase())) || byName.get(sameKey(name));
      if (match) {
        if (!canManageLecturer(me, match)) {
          skipped.push(`${name}: already listed in another department`);
          continue;
        }
        const patch: Record<string, unknown> = { updatedAt: new Date() };
        for (const [k, val] of Object.entries(v)) if (val) patch[k] = val;
        if (dept && !match.dept) patch.dept = dept;
        if (r.category && match.category !== category && !match.rank) patch.category = category;
        await db.update(lecturers).set(patch).where(eq(lecturers.id, match.id));
        updated++;
      } else {
        const [row] = await db.insert(lecturers).values({ name, dept, category, ...v }).returning();
        byName.set(sameKey(name), row);
        if (row.staffNo) byNo.set(row.staffNo.toLowerCase(), row);
        added++;
      }
    }
    if (added || updated) await logChange(me, "staff.import", `Loaded a staff list: ${added} added, ${updated} updated${skipped.length ? `, ${skipped.length} notes` : ""}.`);
    const r = done(`${added} added, ${updated} updated${skipped.length ? ` — see the notes` : ""}.`);
    return { ...r, added, updated, skipped };
  });
}
