import { getTimetableData } from "@/lib/data";
import { TimetableBoard } from "@/components/TimetableBoard";

export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const [data, params] = await Promise.all([getTimetableData(), searchParams]);
  return <TimetableBoard data={data} showId={params.show} />;
}
