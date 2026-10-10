/**
 * FaCoMS — Faculty of Computing Management System.
 * The mark is an "F" drawn as circuit traces: three junctions on the stem and two branch ends,
 * with one gold node (the University's colour) linked in — the Faculty's modules joined on one board.
 */
export function FacomsMark({ size = 40, title = "FaCoMS" }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} className="facoms-mark">
      <rect width="64" height="64" rx="15" fill="#0B2545" />
      <rect x="1.5" y="1.5" width="61" height="61" rx="13.5" fill="none" stroke="#1E4A7A" strokeWidth="3" />
      <g fill="none" stroke="#5FD4C8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 49V16h24" />
        <path d="M21 32h14" />
      </g>
      <path d="M35 32l9 11" fill="none" stroke="#E2B23A" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 5.5" />
      <g fill="#0B2545" stroke="#5FD4C8" strokeWidth="3.5">
        <circle cx="45" cy="16" r="4.5" />
        <circle cx="35" cy="32" r="4.5" />
        <circle cx="21" cy="49" r="4.5" />
      </g>
      <circle cx="46" cy="45" r="5.5" fill="#E2B23A" />
    </svg>
  );
}

/** Mark + wordmark. `tone="light"` on dark backgrounds. */
export function FacomsLogo({ size = 40, tone = "dark", sub = true }: { size?: number; tone?: "dark" | "light"; sub?: boolean }) {
  return (
    <span className={`facoms-logo ${tone}`}>
      <FacomsMark size={size} />
      <span className="facoms-words">
        <b style={{ fontSize: size * 0.62 }}>FaCoMS</b>
        {sub && <small>Faculty of Computing Management System</small>}
      </span>
    </span>
  );
}
