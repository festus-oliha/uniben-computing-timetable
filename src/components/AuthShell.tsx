import { FacomsMark } from "./brand/FacomsLogo";

/** Centered card used by the sign-in and first-time setup pages. */
export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <header>
          <FacomsMark size={46} />
          <div>
            <small>FaCoMS · Faculty of Computing, UNIBEN</small>
            <h1>{title}</h1>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
