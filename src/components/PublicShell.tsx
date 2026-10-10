import Link from "next/link";

/** Header and footer of the public (no sign-in) pages. */
export function PublicShell({ children, subtitle }: { children: React.ReactNode; subtitle: string }) {
  return (
    <div className="pv">
      <header className="pv-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/crest.png" alt="University of Benin crest" />
        <a href="/" className="pv-home" title="Faculty home page">
          <small>University of Benin</small>
          <h1>Faculty of Computing</h1>
          <p>{subtitle}</p>
        </a>
      </header>
      <main className="pv-main">{children}</main>
      <footer className="pv-foot">
        <Link href="/">Faculty of Computing</Link> · University of Benin, Benin City
        <span className="pv-noprint">
          {" "}
          · <Link href="/login">Staff sign in</Link>
        </span>
      </footer>
    </div>
  );
}
