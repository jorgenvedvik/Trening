import { NextResponse } from "next/server";

// Valgfri passordbeskyttelse: sett DASHBOARD_PASSWORD i Vercel for å slå den på.
// Brukernavn kan være hva som helst.
export function middleware(request) {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return NextResponse.next();
  if (request.nextUrl.pathname === "/api/strava/callback") return NextResponse.next();

  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6));
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (given === pw) return NextResponse.next();
  }
  return new NextResponse("Passord kreves", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Lopedashboard"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"] };
