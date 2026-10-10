import "server-only";
import { db } from "./db";
import { auditLog } from "./db/schema";
import { DAYS, SLOTS } from "./timetable";

/** The kinds of change recorded on the History page, grouped for filtering. */
export const AUDIT_GROUPS: Record<string, { label: string; actions: string[] }> = {
  timetable: { label: "Timetable", actions: ["booking.add", "booking.edit", "booking.move", "booking.delete"] },
  courses: { label: "Courses & lecturers", actions: ["course.add", "course.edit", "course.delete", "lecturer.add", "lecturer.remove"] },
  exams: {
    label: "Examinations",
    actions: ["exam.create", "exam.setup", "exam.publish", "exam.delete", "exam.signoff", "exam.paper.add", "exam.paper.edit", "exam.paper.move", "exam.paper.delete"],
  },
  signoff: { label: "Sign-off", actions: ["signoff.save", "signoff.clear"] },
  accounts: { label: "Accounts", actions: ["user.create", "user.update", "user.reset"] },
  settings: { label: "Settings", actions: ["semester.create", "semester.current", "semester.publish", "venue.add", "venue.edit"] },
};

/** "THU 10–11 (2 h) in P1" */
export function slotText(b: { venueCode: string; day: number; start: number; span: number }) {
  return `${DAYS[b.day]} ${SLOTS[b.start]}${b.span > 1 ? ` (${b.span} h)` : ""} in ${b.venueCode}`;
}

/**
 * Records one change. Never throws — a failed history write must not undo or block the change itself.
 */
export async function logChange(
  who: { id: string; name: string } | null,
  action: string,
  summary: string,
  semesterId: number | null = null,
) {
  try {
    await db.insert(auditLog).values({ userId: who?.id ?? null, userName: who?.name ?? "System", action, summary, semesterId });
  } catch (err) {
    console.error("Could not write change history:", err);
  }
}
