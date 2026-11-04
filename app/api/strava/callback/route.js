// Steg 2: Strava sender deg hit med en kode. Vi bytter den mot en refresh token
// og viser den én gang, så du kan lime den inn som STRAVA_REFRESH_TOKEN i Vercel.

const page = (body) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Strava-tilkobling</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;background:#f6f4ef;color:#16181d}
code{display:block;padding:12px;background:#fff;border:1px solid #ddd;border-radius:8px;word-break:break-all;font-size:15px}
ol li{margin:6px 0}</style>${body}`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const scope = url.searchParams.get("scope") || "";
  if (!code) return page(`<h1>Ingen kode</h1><p>Strava sendte ingen kode. Prøv <a href="/api/strava/connect">på nytt</a>.</p>`);
  if (!scope.includes("activity:read")) {
    return page(`<h1>Mangler tilgang</h1><p>Huk av for å vise aktiviteter når Strava spør. <a href="/api/strava/connect">Prøv igjen</a>.</p>`);
  }

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json.refresh_token) {
    return page(`<h1>Noe gikk galt</h1><p>Sjekk at STRAVA_CLIENT_SECRET er riktig.</p><code>${JSON.stringify(json)}</code>`);
  }

  return page(`<h1>Nesten ferdig ✓</h1>
<p>Hei ${json.athlete?.firstname ?? ""}! Her er refresh-tokenet ditt:</p>
<code>${json.refresh_token}</code>
<ol>
<li>Kopier tokenet over.</li>
<li>Vercel → prosjektet → Settings → Environment Variables → legg til <b>STRAVA_REFRESH_TOKEN</b>.</li>
<li>Deployments → ⋯ → Redeploy.</li>
</ol>
<p>Ikke del tokenet med noen.</p>`);
}
