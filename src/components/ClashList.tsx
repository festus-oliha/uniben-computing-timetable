"use client";

import Link from "next/link";
import type { Clash } from "@/lib/clash";

const TITLES: Record<Clash["type"], string> = {
  venue: "Venue",
  students: "Students",
  lecturer: "Lecturer",
  jumat: "Jumat",
};

/** A list of clash cards. With `onShow` the button highlights the booking on this page; without it, it links to the timetable. */
export function ClashList({ clashes, limit, onShow }: { clashes: Clash[]; limit?: number; onShow?: (id: string) => void }) {
  if (!clashes.length) return <p className="okmsg">No clashes found.</p>;
  const shown = limit ? clashes.slice(0, limit) : clashes;
  return (
    <div>
      {shown.map((c, i) => (
        <div key={`${c.type}-${c.bookingIds.join("-")}-${i}`} className={`issue${c.severity === "warning" ? " warn" : ""}`}>
          <div className="t">{TITLES[c.type]}</div>
          {c.message}
          <br />
          {onShow ? (
            <button type="button" className="linkbtn" onClick={() => onShow(c.bookingIds[0])}>
              Show on timetable
            </button>
          ) : (
            <Link className="linkbtn" href={`/timetable?show=${encodeURIComponent(c.bookingIds[0])}`}>
              Show on timetable
            </Link>
          )}
        </div>
      ))}
      {limit && clashes.length > limit && <p className="hint">{clashes.length - limit} more on the Clashes tab.</p>}
    </div>
  );
}
