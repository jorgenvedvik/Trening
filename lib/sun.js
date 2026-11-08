// Soloppgang og solnedgang (NOAA-forenklet algoritme, ±1–2 min). Standard: Oslo sentrum.

const OSLO = { lat: 59.9139, lng: 10.7522 };
const rad = Math.PI / 180;

/** Returnerer { rise: Date|null, set: Date|null } for kalenderdagen til `date` (UTC-basert). */
export function sunTimes(date, { lat, lng } = OSLO) {
  const y = date.getUTCFullYear(), m = date.getUTCMonth(), d = date.getUTCDate();
  const start = Date.UTC(y, 0, 0);
  const N = Math.round((Date.UTC(y, m, d) - start) / 864e5);
  const lngHour = lng / 15;

  const calc = (rising) => {
    const t = N + ((rising ? 6 : 18) - lngHour) / 24;
    const M = 0.9856 * t - 3.289;
    let L = M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634;
    L = (L + 360) % 360;
    let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
    RA = (RA + 360) % 360;
    RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
    RA /= 15;
    const sinDec = 0.39782 * Math.sin(L * rad);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
    if (cosH > 1 || cosH < -1) return null; // mørketid / midnattssol
    let H = Math.acos(cosH) / rad;
    H = (rising ? 360 - H : H) / 15;
    const T = H + RA - 0.06571 * t - 6.622;
    const UT = (((T - lngHour) % 24) + 24) % 24;
    return new Date(Date.UTC(y, m, d) + UT * 36e5);
  };

  return { rise: calc(true), set: calc(false) };
}
