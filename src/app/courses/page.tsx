import { getTimetableData } from "@/lib/data";
import { CoursesTable } from "@/components/CoursesTable";

export default async function CoursesPage() {
  return <CoursesTable data={await getTimetableData()} />;
}
