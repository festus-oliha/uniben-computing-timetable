import Link from "next/link";
import { SITE } from "@/lib/site-content";
import { FacomsLogo } from "./FacomsLogo";

/** Thin university strip at the very top of every public page, linking to the main UNIBEN website. */
export function UnibenStrip({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="uniben-strip">
      <a href={SITE.universityUrl} className="us-uni" target="_blank" rel="noopener">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/crest.png" alt="" />
        <span>{SITE.university}</span>
      </a>
      <nav aria-label="University links">
        <a href={SITE.universityUrl} target="_blank" rel="noopener">
          uniben.edu
        </a>
        {signedIn ? <Link href="/timetable">Staff workspace</Link> : <Link href="/login">Staff sign in</Link>}
      </nav>
    </div>
  );
}

/** Header for module pages: FaCoMS logo and the module's name. */
export function ModuleHeader({ module, signedIn }: { module: string; signedIn: boolean }) {
  return (
    <header className="mod-head">
      <UnibenStrip signedIn={signedIn} />
      <div className="mod-bar">
        <Link href="/" className="mod-home" aria-label="FaCoMS home">
          <FacomsLogo size={38} tone="light" sub={false} />
        </Link>
        <span className="mod-name">{module}</span>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div>
        <b>{SITE.name}</b> — {SITE.fullName}
        <br />
        {SITE.faculty}, {SITE.university}
      </div>
      <nav aria-label="Footer">
        <Link href="/">Home</Link>
        <Link href="/timetables">Timetables</Link>
        <a href={SITE.universityUrl} target="_blank" rel="noopener">
          University of Benin website
        </a>
        <Link href="/login">Staff sign in</Link>
      </nav>
    </footer>
  );
}
