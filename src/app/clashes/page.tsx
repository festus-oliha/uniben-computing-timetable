import { clashesFor, getTimetableData } from "@/lib/data";
import { ClashList } from "@/components/ClashList";

export default async function ClashesPage() {
  const clashes = clashesFor(await getTimetableData());
  return (
    <section className="card">
      <h2>All clashes and warnings</h2>
      <p className="hint">
        Student clashes depend on which courses are marked <b>common</b> on the Courses tab. Courses written together in one
        booking (CSC308/CSC411) are treated as taught together and never clash with each other.
      </p>
      <ClashList clashes={clashes} />
    </section>
  );
}
