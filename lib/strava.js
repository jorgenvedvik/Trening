import snapshot from "../data/strava-snapshot.json";

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

export function stravaConfigured() {
  return Boolean(
    process.env.STRAVA_CLIENT_ID &&
      process.env.STRAVA_CLIENT_SECRET &&
      process.env.STRAVA_REFRESH_TOKEN
  );
}

async function getAccessToken() {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: process.env.STRAVA_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Strava token: ${res.status}`);
  const json = await res.json();
  return json.access_token;
}

function normalize(a) {
  return {
    date: (a.start_date_local || "").slice(0, 10),
    name: a.name,
    type: a.sport_type || a.type,
    km: Math.round((a.distance / 1000) * 100) / 100,
    movingTime: a.moving_time,
    elevation: Math.round(a.total_elevation_gain || 0),
    cadence: a.average_cadence ? Math.round(a.average_cadence * 2) : null,
    avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    maxHr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    id: a.id,
  };
}

/**
 * Henter løpeturer fra og med `sinceIso` (YYYY-MM-DD).
 * Faller tilbake til data/strava-snapshot.json hvis Strava ikke er satt opp eller feiler.
 */
export async function getRuns(sinceIso) {
  const fallback = {
    source: "snapshot",
    updated: snapshot.updated,
    runs: snapshot.activities.filter((a) => RUN_TYPES.has(a.type) && a.date >= sinceIso),
  };

  if (!stravaConfigured()) return fallback;

  try {
    const token = await getAccessToken();
    // Én dag ekstra slakk for tidssoner; filtreres på lokal dato under.
    const after = Math.floor(new Date(sinceIso + "T00:00:00Z").getTime() / 1000) - 86400;
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 600 },
      }
    );
    if (!res.ok) throw new Error(`Strava activities: ${res.status}`);
    const list = await res.json();
    const runs = list
      .filter((a) => RUN_TYPES.has(a.sport_type || a.type))
      .map(normalize)
      .filter((a) => a.date >= sinceIso)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return { source: "strava", updated: new Date().toISOString(), runs };
  } catch (err) {
    console.error(err);
    return { ...fallback, error: String(err.message || err) };
  }
}
