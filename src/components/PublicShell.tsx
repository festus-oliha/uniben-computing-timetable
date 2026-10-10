import Link from "next/link";
import { FacomsMark } from "./brand/FacomsLogo";
import { Credit } from "./brand/SiteChrome";

/** Header and footer of the public (no sign-in) pages. */
export function PublicShell({ children, subtitle }: { children: React.ReactNode; subtitle: string }) {
  return (
    <div className="pv">
      <header className="pv-top">
        <a href="/" className="pv-home" title="FaCoMS home">
          <FacomsMark size={46} />
          <span>
            <small>FaCoMS · Faculty of Computing</small>
            <h1>{subtitle.split(" · ")[0]}</h1>
            {subtitle.includes(" · ") && <p>{subtitle.split(" · ").slice(1).join(" · ")}</p>}
          </span>
        </a>
      </header>
      <main className="pv-main">{children}</main>
      <footer className="pv-foot">
        <Link href="/">FaCoMS</Link> · Faculty of Computing, <a href="https://www.uniben.edu/" target="_blank" rel="noopener">University of Benin</a> ·{" "}
        <Link href="/timetables">All timetables</Link>
        <br />
        <Credit />
        <span className="pv-noprint">
          {" "}
          · <Link href="/login">Staff sign in</Link>
        </span>
      </footer>
    </div>
  );
}
