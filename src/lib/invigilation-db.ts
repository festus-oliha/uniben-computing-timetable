import "server-only";
import { db } from "./db";
import { examPapers, examTimetables } from "./db/schema";
import { eq } from "drizzle-orm";

/** Takes a person off every assistant list and invigilators list (chief places clear themselves via the foreign key). */
export async function forgetInvigilator(lecturerId: string) {
  for (const p of await db.select({ id: examPapers.id, ids: examPapers.invigilatorIds }).from(examPapers))
    if (p.ids.includes(lecturerId)) await db.update(examPapers).set({ invigilatorIds: p.ids.filter((x) => x !== lecturerId) }).where(eq(examPapers.id, p.id));
  for (const t of await db.select({ id: examTimetables.id, pool: examTimetables.invigilatorPool }).from(examTimetables))
    if (t.pool?.includes(lecturerId)) await db.update(examTimetables).set({ invigilatorPool: t.pool.filter((x) => x !== lecturerId) }).where(eq(examTimetables.id, t.id));
}
