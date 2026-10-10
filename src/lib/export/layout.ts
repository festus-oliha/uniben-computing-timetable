import { categoryOf, type Category } from "../timetable";
import type { BookingDTO, TimetableData, VenueDTO } from "../types";

/** One printed cell: a booking (or several overlapping ones) spanning `span` slots from `start`. */
export interface PrintCell {
  start: number;
  span: number;
  text: string;
  category: Category;
  italic: boolean;
}

export interface PrintRow {
  day: number;
  /** Cells sorted by start; gaps between them are empty slots. */
  cells: PrintCell[];
}

export interface PrintVenue {
  venue: VenueDTO;
  rows: PrintRow[];
}

/**
 * Turns bookings into printable rows: one row per venue per day, each a list of cells.
 * Other faculties' bookings are left out (they print as blanks, as on the paper timetable).
 * If two bookings overlap in one venue (a venue clash), they share one cell so nothing is lost.
 */
export function printLayout(data: TimetableData): PrintVenue[] {
  return data.venues.map((venue) => ({
    venue,
    rows: [0, 1, 2, 3, 4].map((day) => ({
      day,
      cells: rowCells(data.bookings.filter((b) => b.venueCode === venue.code && b.day === day && b.kind !== "shared")),
    })),
  }));
}

function labelOf(b: BookingDTO) {
  return b.kind === "pt" ? "PART-TIME (PT)" : b.label;
}

function rowCells(bookings: BookingDTO[]): PrintCell[] {
  const sorted = [...bookings].sort((a, b) => a.start - b.start || b.span - a.span);
  const cells: PrintCell[] = [];
  for (const b of sorted) {
    const last = cells[cells.length - 1];
    const end = b.start + b.span;
    // Never merge across the 2:00 break (slot 5 → 6).
    if (last && b.start < last.start + last.span && (last.start < 6) === (b.start < 6)) {
      if (!last.text.split(" / ").includes(labelOf(b))) last.text += ` / ${labelOf(b)}`;
      last.span = Math.max(last.start + last.span, end) - last.start;
      continue;
    }
    cells.push({
      start: b.start,
      span: Math.min(b.span, (b.start < 6 ? 6 : 10) - b.start),
      text: labelOf(b),
      category: categoryOf(b),
      italic: b.kind === "activity",
    });
  }
  return cells;
}
