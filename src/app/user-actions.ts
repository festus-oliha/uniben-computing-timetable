"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, temporaryPassword } from "@/lib/auth/password";
import { endAllSessions, getCurrentUser } from "@/lib/auth/session";
import { canManageUsers, type Role } from "@/lib/permissions";
import { FACULTY_DEPTS } from "@/lib/timetable";

/** Result for account actions; `tempPassword` is shown once so the admin can pass it on. */
export type UserActionResult = { ok: true; message: string; tempPassword?: string } | { ok: false; error: string };

const ROLES: Role[] = ["admin", "dept_officer", "viewer"];
const looksLikeEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function adminOnly(): Promise<{ id: string } | UserActionResult> {
  const me = await getCurrentUser();
  if (!me || !canManageUsers(me)) return { ok: false, error: "Only the Faculty Time-Table Officer can manage accounts." };
  return me;
}

function checkRoleDept(role: Role, dept: string | null): string | null {
  if (!ROLES.includes(role)) return "Pick a role.";
  if (role === "dept_officer" && !(FACULTY_DEPTS as readonly string[]).includes(dept ?? "")) return "Pick the officer's department.";
  return null;
}

async function otherActiveAdmins(exceptId: string) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true), ne(users.id, exceptId)));
  return rows.length;
}

export async function createUser(input: { name: string; email: string; role: Role; dept: string | null }): Promise<UserActionResult> {
  const me = await adminOnly();
  if ("ok" in me) return me;
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Enter the person's name." };
  if (!looksLikeEmail(email)) return { ok: false, error: "Enter a valid email address." };
  const bad = checkRoleDept(input.role, input.dept);
  if (bad) return { ok: false, error: bad };
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) return { ok: false, error: "An account with that email already exists." };

  const temp = temporaryPassword();
  await db.insert(users).values({
    name,
    email,
    role: input.role,
    dept: input.role === "dept_officer" ? input.dept : null,
    passwordHash: await hashPassword(temp),
    mustChangePassword: true,
  });
  revalidatePath("/users");
  return { ok: true, message: `Account created for ${name}.`, tempPassword: temp };
}

export async function updateUser(input: { id: string; role: Role; dept: string | null; isActive: boolean }): Promise<UserActionResult> {
  const me = await adminOnly();
  if ("ok" in me) return me;
  const bad = checkRoleDept(input.role, input.dept);
  if (bad) return { ok: false, error: bad };
  const [u] = await db.select().from(users).where(eq(users.id, input.id));
  if (!u) return { ok: false, error: "That account no longer exists." };

  const losingAdmin = u.role === "admin" && u.isActive && (input.role !== "admin" || !input.isActive);
  if (losingAdmin && (await otherActiveAdmins(u.id)) === 0)
    return { ok: false, error: "There must always be at least one active Faculty Time-Table Officer." };

  await db
    .update(users)
    .set({ role: input.role, dept: input.role === "dept_officer" ? input.dept : null, isActive: input.isActive })
    .where(eq(users.id, input.id));
  if (!input.isActive) await endAllSessions(input.id);
  revalidatePath("/users");
  return { ok: true, message: input.isActive ? `${u.name} updated.` : `${u.name} switched off and signed out.` };
}

export async function resetUserPassword(id: string): Promise<UserActionResult> {
  const me = await adminOnly();
  if ("ok" in me) return me;
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) return { ok: false, error: "That account no longer exists." };
  const temp = temporaryPassword();
  await db.update(users).set({ passwordHash: await hashPassword(temp), mustChangePassword: true }).where(eq(users.id, id));
  await endAllSessions(id);
  revalidatePath("/users");
  return { ok: true, message: `Password reset for ${u.name}. They've been signed out everywhere.`, tempPassword: temp };
}
