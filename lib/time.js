// Dato-hjelpere som alltid regner i Oslo-tid (Vercel kjører i UTC).

const TZ = "Europe/Oslo";

export function osloToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // "YYYY-MM-DD"
}

// Rene datoer som "YYYY-MM-DD", regnet som UTC-midnatt for enkel aritmetikk.
export function toDate(iso) {
  return new Date(iso.slice(0, 10) + "T00:00:00Z");
}

export function toIso(d) {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

// 1 = mandag … 7 = søndag
export function weekday(iso) {
  const w = toDate(iso).getUTCDay();
  return w === 0 ? 7 : w;
}

export function mondayOf(iso) {
  return addDays(iso, 1 - weekday(iso));
}

export function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}

export function isoWeekNumber(iso) {
  const d = toDate(iso);
  const day = weekday(iso);
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

const MONTHS = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

export function shortDate(iso) {
  const d = toDate(iso);
  return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`;
}

export function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} t ${m} min` : `${m} min`;
}

export function formatPace(sec, km) {
  if (!km) return "–";
  const p = sec / km;
  const m = Math.floor(p / 60);
  const s = Math.round(p % 60).toString().padStart(2, "0");
  return `${m}:${s} /km`;
}
