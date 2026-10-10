/** Centered card used by the sign-in and first-time setup pages. */
export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <header>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/crest.png" alt="University of Benin crest" />
          <div>
            <small>University of Benin · Faculty of Computing</small>
            <h1>{title}</h1>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
