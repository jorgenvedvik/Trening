import { NextResponse } from "next/server";

// Steg 1: send deg til Strava for å godkjenne lesetilgang.
export function GET(request) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) {
    return new NextResponse(
      "Mangler STRAVA_CLIENT_ID i Vercel → Settings → Environment Variables. Legg den inn, redeploy, og prøv igjen.",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
  const origin = new URL(request.url).origin;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/strava/callback`,
    response_type: "code",
    approval_prompt: "force",
    scope: "read,activity:read_all",
  });
  return NextResponse.redirect(`https://www.strava.com/oauth/authorize?${params}`);
}
