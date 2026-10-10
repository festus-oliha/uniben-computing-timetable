import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/permissions";
import { UsersPanel } from "@/components/UsersPanel";

export const metadata = { title: "Users — FaCoMS Timetable" };

export default async function UsersPage() {
  const me = await requireUser();
  if (!canManageUsers(me)) redirect("/timetable");
  const rows = await db.select().from(users).orderBy(asc(users.name));
  return (
    <UsersPanel
      meId={me.id}
      rows={rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        dept: u.dept,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      }))}
    />
  );
}
