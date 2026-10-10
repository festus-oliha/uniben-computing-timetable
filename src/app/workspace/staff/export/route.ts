import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth/session";
import { listStaffRows } from "@/lib/staff-data";
import { DEPARTMENTS } from "@/lib/timetable";
import { CATEGORIES, type StaffCategory } from "@/lib/staff";

export const dynamic = "force-dynamic";

/** GET /workspace/staff/export — the staff list as an Excel file (signed-in staff only; includes contacts). */
export async function GET(req: Request) {
  if (!(await getCurrentUser())) return Response.redirect(new URL("/login?next=/workspace/staff", req.url), 303);
  const rows = (await listStaffRows()).map((l) => ({
    Name: l.name,
    Department: l.dept ? DEPARTMENTS[l.dept] ?? l.dept : "",
    Category: CATEGORIES[l.category as StaffCategory]?.label ?? l.category,
    Rank: l.rank,
    Position: l.position,
    Qualifications: l.qualifications,
    "Research interests": l.interests,
    Email: l.email,
    Phone: l.phone,
    "Staff number": l.staffNo,
    Office: l.office,
    Status: l.isActive ? "Current" : "Left",
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [32, 30, 14, 22, 24, 26, 34, 28, 16, 14, 18, 10].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Staff");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="FaCoMS_Staff_List_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
