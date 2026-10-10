import { getStaffRow } from "@/lib/staff-data";

/** GET /staff-photo/:id — a staff member's photo (public for current staff). Cached; the URL changes when the record does. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const l = await getStaffRow((await params).id);
  if (!l?.photo || !l.isActive) return new Response("Not found", { status: 404 });
  const m = l.photo.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(m[2], "base64")), {
    headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
