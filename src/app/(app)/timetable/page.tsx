import { getTimetableData } from "@/lib/data";
import { requireUser } from "@/lib/auth/session";
import { TimetableBoard } from "@/components/TimetableBoard";

export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const [me, data, params] = await Promise.all([requireUser(), getTimetableData(), searchParams]);
  return <TimetableBoard data={data} showId={params.show} actor={{ role: me.role, dept: me.dept }} />;
}
