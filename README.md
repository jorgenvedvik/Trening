# Løpedashboard

Personlig dashboard for løpeplanen mot Oslo Maraton 2027: km denne uka, dagens økt, ukeplan, styrkeplan (slot-basert), ukesmål og siste løpeturer fra Strava.

- **Planen** ligger i `data/plan.json` (ukesmål, ukemal, økter, styrke). Endre der.
- **Strava**: live-data når miljøvariablene under er satt i Vercel, ellers brukes `data/strava-snapshot.json`.

## Koble til Strava (én gang)

1. Gå til <https://www.strava.com/settings/api> og lag en app.
   - *Authorization Callback Domain*: domenet fra Vercel, f.eks. `lopedashboard.vercel.app` (uten https://).
2. I Vercel → Settings → Environment Variables, legg inn `STRAVA_CLIENT_ID` og `STRAVA_CLIENT_SECRET`. Redeploy.
3. Åpne `https://<ditt-domene>/api/strava/connect`, godkjenn, og kopier refresh-tokenet du får.
4. Legg det inn som `STRAVA_REFRESH_TOKEN` i Vercel og redeploy.

Valgfritt: sett `DASHBOARD_PASSWORD` for å passordbeskytte siden.
