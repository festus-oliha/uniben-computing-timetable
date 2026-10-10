import { NextResponse, type NextRequest } from "next/server";

/**
 * Temporary protection until proper logins are added (see README → Roadmap).
 * When SITE_PASSWORD is set, the browser asks for a username (anything) and that password.
 * When it's empty — the usual case on localhost — the app is open.
 */
export function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (given === password) return NextResponse.next();
    } catch {
      // fall through to the challenge
    }
  }
  return new NextResponse("Sign in to view the Faculty of Computing timetable.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Faculty of Computing Timetable", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|icon.png|crest.png).*)"],
};
