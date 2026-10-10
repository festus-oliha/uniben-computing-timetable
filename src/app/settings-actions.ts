"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, semesters, venues } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import { logChange } from "@/lib/audit";
import { COPY_MODES, sessionProblem, shouldCopy, type CopyMode } from "@/lib/semester";
import type { ActionResult } from "@/lib/types";

async function adminGuard(fn: (me: { id: string; name: string }) => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const me = await getCurrentUser();
    if (!me || !isAdmin(me)) return { ok: false, error: "Only the Faculty Time-Table Officer can change settings." };
    const r = await fn(me);
    if (r.ok) revalidatePath("/", "layout");
    return r;
  } catch (err) {
    console.error(err);
    return { ok: false, error: "The change could not be saved. Check the database connection and try again." };
  }
}

export interface NewSemesterInput {
  session: string;
  name: string;
  copyFrom: number | null;
  copyMode: CopyMode;
  makeCurrent: boolean;
}

export async function createSemester(input: NewSemesterInput): Promise<ActionResult> {
  return adminGuard(async (me) => {
    const session = input.session.trim();
    const name = input.name.trim();
    const bad = sessionProblem(session);
    if (bad) return { ok: false, error: bad };
    if (!name) return { ok: false, error: "Name the semester, e.g. Second Semester." };
    if (!(input.copyMode in COPY_MODES)) return { ok: false, error: "Choose what to copy." };
    const [dup] = await db.select().from(semesters).where(and(eq(semesters.session, session), eq(semesters.name, name)));
    if (dup) return { ok: false, error: `${session} ${name} already exists.` };

    const [sem] = await db.insert(semesters).values({ session, name, isCurrent: false }).returning();

    let copied = 0;
    if (input.copyFrom && input.copyMode !== "none") {
      const src = await db.select().from(bookings).where(eq(bookings.semesterId, input.copyFrom));
      const rows = src
        .filter((b) => shouldCopy(input.copyMode, b.kind))
        .map((b) => ({ semesterId: sem.id, venueCode: b.venueCode, day: b.day, start: b.start, span: b.span, label: b.label, kind: b.kind, note: b.note }));
      if (rows.length) await db.insert(bookings).values(rows);
      copied = rows.length;
    }
    if (input.makeCurrent) {
      await db.update(semesters).set({ isCurrent: false }).where(ne(semesters.id, sem.id));
      await db.update(semesters).set({ isCurrent: true }).where(eq(semesters.id, sem.id));
    }
    await logChange(
      me,
      "semester.create",
      `Started ${session} ${name}${copied ? ` with ${copied} bookings copied (${COPY_MODES[input.copyMode].label.toLowerCase()})` : " with a blank timetable"}${input.makeCurrent ? "; made it the current semester" : ""}.`,
      sem.id,
    );
    return { ok: true, message: `${session} ${name} created${copied ? ` with ${copied} bookings` : ""}.` };
  });
}

export async function setCurrentSemester(id: number): Promise<ActionResult> {
  return adminGuard(async (me) => {
    const [sem] = await db.select().from(semesters).where(eq(semesters.id, id));
    if (!sem) return { ok: false, error: "That semester no longer exists." };
    await db.update(semesters).set({ isCurrent: false }).where(ne(semesters.id, id));
    await db.update(semesters).set({ isCurrent: true }).where(eq(semesters.id, id));
    await logChange(me, "semester.current", `Made ${sem.session} ${sem.name} the current semester.`, id);
    return { ok: true, message: `Everyone now sees ${sem.session} ${sem.name}.` };
  });
}

export async function setPublished(id: number, published: boolean): Promise<ActionResult> {
  return adminGuard(async (me) => {
    const [sem] = await db.select().from(semesters).where(eq(semesters.id, id));
    if (!sem) return { ok: false, error: "That semester no longer exists." };
    await db.update(semesters).set({ isPublished: published, publishedAt: published ? new Date() : null }).where(eq(semesters.id, id));
    await logChange(me, "semester.publish", `${published ? "Published" : "Unpublished"} ${sem.session} ${sem.name} on the public timetable.`, id);
    return { ok: true, message: published ? "Published: students can now see this semester." : "Unpublished: the public page no longer shows it." };
  });
}

export interface VenueInput {
  code: string;
  name: string;
  seats: number;
  sortOrder: number;
  isNew: boolean;
}

export async function saveVenue(input: VenueInput): Promise<ActionResult> {
  return adminGuard(async (me) => {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (!/^[A-Z0-9]{1,6}$/.test(code)) return { ok: false, error: "Venue codes are 1–6 letters or numbers, e.g. P5." };
    if (!name) return { ok: false, error: "Describe the venue, e.g. 500 LT." };
    if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 5000) return { ok: false, error: "Seats must be a whole number from 1 to 5000." };
    if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 999) return { ok: false, error: "Order must be a whole number." };
    const [existing] = await db.select().from(venues).where(eq(venues.code, code));
    if (input.isNew) {
      if (existing) return { ok: false, error: `Venue ${code} already exists.` };
      await db.insert(venues).values({ code, name, seats: input.seats, sortOrder: input.sortOrder });
      await logChange(me, "venue.add", `Added venue ${code} — ${name} (${input.seats} seats).`);
      return { ok: true, message: `Venue ${code} added.` };
    }
    if (!existing) return { ok: false, error: `Venue ${code} no longer exists.` };
    await db.update(venues).set({ name, seats: input.seats, sortOrder: input.sortOrder }).where(eq(venues.code, code));
    const changes: string[] = [];
    if (existing.name !== name) changes.push(`name “${existing.name}” → “${name}”`);
    if (existing.seats !== input.seats) changes.push(`seats ${existing.seats} → ${input.seats}`);
    if (existing.sortOrder !== input.sortOrder) changes.push(`order ${existing.sortOrder} → ${input.sortOrder}`);
    if (changes.length) await logChange(me, "venue.edit", `Venue ${code}: ${changes.join("; ")}.`);
    return { ok: true, message: `Venue ${code} saved.` };
  });
}
