import { redirect } from "next/navigation";
import { asc, count, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, semesters, venues } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import { SettingsPanel } from "@/components/SettingsPanel";

export const metadata = { title: "Settings — Faculty of Computing Timetable" };

export default async function SettingsPage() {
  const me = await requireUser();
  if (!isAdmin(me)) redirect("/");
  const [sems, vens, perSem, perVenue] = await Promise.all([
    db.select().from(semesters).orderBy(desc(semesters.session), desc(semesters.name)),
    db.select().from(venues).orderBy(asc(venues.sortOrder), asc(venues.code)),
    db.select({ id: bookings.semesterId, n: count() }).from(bookings).groupBy(bookings.semesterId),
    db.select({ code: bookings.venueCode, n: count() }).from(bookings).groupBy(bookings.venueCode),
  ]);
  const semCount = new Map(perSem.map((r) => [r.id, Number(r.n)]));
  const venueCount = new Map(perVenue.map((r) => [r.code, Number(r.n)]));
  return (
    <SettingsPanel
      semesters={sems.map((s) => ({
        id: s.id,
        session: s.session,
        name: s.name,
        isCurrent: s.isCurrent,
        isPublished: s.isPublished,
        bookings: semCount.get(s.id) ?? 0,
        signedOn: s.signedOn,
      }))}
      venues={vens.map((v) => ({ code: v.code, name: v.name, seats: v.seats, sortOrder: v.sortOrder, bookings: venueCount.get(v.code) ?? 0 }))}
    />
  );
}
