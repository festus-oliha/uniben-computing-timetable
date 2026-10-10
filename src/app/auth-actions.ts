"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { countUsers, endSession, getCurrentUser, startSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/types";
import { logChange } from "@/lib/audit";

/** Form result that also hands back what was typed, so the form can keep it after an error. */
export type FormState = ActionResult & { values?: Record<string, string> };

// A real hash to compare against when the email isn't found, so both paths take the same time.
const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

const cleanEmail = (e: string) => e.trim().toLowerCase();
const looksLikeEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function login(_prev: FormState | null, form: FormData): Promise<FormState> {
  const email = cleanEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") || "/timetable");
  const values = { email };
  if (!email || !password) return { ok: false, error: "Enter your email and password.", values };

  const [u] = await db.select().from(users).where(eq(users.email, email));
  const ok = await verifyPassword(password, u?.passwordHash ?? DUMMY_HASH);
  if (!u || !ok) {
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing a little
    return { ok: false, error: "That email and password don't match an account.", values };
  }
  if (!u.isActive) return { ok: false, error: "This account has been switched off. Contact the Faculty Time-Table Officer.", values };

  await startSession(u.id);
  redirect(u.mustChangePassword ? "/account?first=1" : next.startsWith("/") && !next.startsWith("//") && next !== "/" ? next : "/timetable");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

/** Creates the very first account (the Faculty Time-Table Officer). Only works while there are no accounts. */
export async function setupFirstAdmin(_prev: FormState | null, form: FormData): Promise<FormState> {
  if ((await countUsers()) > 0) return { ok: false, error: "The first account has already been created. Sign in instead." };
  const name = String(form.get("name") ?? "").trim();
  const email = cleanEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const values = { name, email };
  if (!name) return { ok: false, error: "Enter your name.", values };
  if (!looksLikeEmail(email)) return { ok: false, error: "Enter a valid email address.", values };
  const weak = passwordProblem(password);
  if (weak) return { ok: false, error: weak, values };
  if (password !== confirm) return { ok: false, error: "The two passwords don't match.", values };

  const [u] = await db
    .insert(users)
    .values({ name, email, role: "admin", passwordHash: await hashPassword(password), mustChangePassword: false })
    .returning({ id: users.id });
  await logChange({ id: u.id, name }, "user.create", `Created the first Faculty Time-Table Officer account (${email}).`);
  await startSession(u.id);
  redirect("/timetable");
}

export async function changeOwnPassword(_prev: FormState | null, form: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const current = String(form.get("current") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const [u] = await db.select().from(users).where(eq(users.id, me.id));
  if (!u || !(await verifyPassword(current, u.passwordHash))) return { ok: false, error: "Your current password isn't right." };
  const weak = passwordProblem(password);
  if (weak) return { ok: false, error: weak };
  if (password !== confirm) return { ok: false, error: "The two new passwords don't match." };
  if (password === current) return { ok: false, error: "Choose a password different from the current one." };
  await db.update(users).set({ passwordHash: await hashPassword(password), mustChangePassword: false }).where(eq(users.id, me.id));
  return { ok: true, message: "Password changed." };
}

