"use client";

/** Opens the browser's print dialog, where "Save as PDF" is one of the printers. */
export function PrintButton() {
  return (
    <button type="button" className="btn primary" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
