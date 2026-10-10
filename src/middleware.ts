import { NextResponse, type NextRequest } from "next/server";

/**
 * Sends anyone without a sign-in cookie to the sign-in page. The home page ("/") and the public pages stay open.
 * (This only checks that a cookie exists; every page and action also checks the session against the database.)
 */
const PUBLIC = ["/login", "/setup", "/view", "/export/exam"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/" || PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (req.cookies.has("tt_session")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|icon.png|crest.png|favicon.ico).*)"],
};
