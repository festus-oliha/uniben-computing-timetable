import { getTimetableData } from "@/lib/data";
import { LecturersPanel } from "@/components/LecturersPanel";

export default async function LecturersPage() {
  return <LecturersPanel data={await getTimetableData()} />;
}
