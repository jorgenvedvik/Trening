import plan from "../data/plan.json";
import { addDays, daysBetween, mondayOf, weekday } from "./time";

export { plan };

const round05 = (x) => Math.round(x * 2) / 2;
const mod = (a, n) => ((a % n) + n) % n;

/* ---------------- Split: push → legs → pull på repeat ---------------- */

/** Styrketype for en dato. */
export function strengthFor(iso) {
  const { anchorDate, sequence } = plan.split;
  return sequence[mod(daysBetween(anchorDate, iso), sequence.length)];
}

/** Tung eller moderat legday. Moderat før/på langturen og i deload-uker, ellers annenhver. */
export function legsModeFor(iso) {
  const wd = weekday(iso);
  if (wd === 5 || wd === 6) return "moderat";
  const wk = plan.weeks.find((w) => w.start === mondayOf(iso));
  if (wk?.deload) return "moderat";
  const legsCount = Math.floor(daysBetween(plan.split.anchorDate, iso) / plan.split.sequence.length);
  return mod(legsCount, 2) === 0 ? "tung" : "moderat";
}

/** Finn planuka som inneholder datoen. Returnerer null utenfor planen. */
export function weekFor(iso) {
  const monday = mondayOf(iso);
  const idx = plan.weeks.findIndex((w) => w.start === monday);
  if (idx === -1) return null;
  const w = plan.weeks[idx];
  const number = idx + 1;
  return { ...w, number, end: addDays(w.start, 6), days: dayPlan(w, number) };
}

/** Fordel ukas km på løpedagene. */
function dayPlan(week, number) {
  const template = plan.weekTemplate;
  const runDays = template.filter(
    (d) => d.run && d.run !== "long" && (!d.fromWeek || number >= d.fromWeek)
  );
  const rest = week.km - week.long;
  const totalShare = runDays.reduce((s, d) => s + d.share, 0);

  const distances = {};
  let used = 0;
  runDays.forEach((d, i) => {
    if (i === runDays.length - 1) {
      distances[d.day] = round05(rest - used);
    } else {
      const km = round05((rest * d.share) / totalShare);
      distances[d.day] = km;
      used += km;
    }
  });

  return template.map((d) => {
    const active = d.run && (!d.fromWeek || number >= d.fromWeek);
    let km = null;
    if (active) km = d.run === "long" ? week.long : distances[d.day];
    const date = addDays(week.start, d.day - 1);
    const strength = strengthFor(date);
    return {
      ...d,
      date,
      strength,
      // Ingen terskel i deload-uker eller på legday – da blir det rolig
      run: active ? (d.run === "quality" && (week.deload || strength === "legs") ? "easy" : d.run) : null,
      runLabel: d.run === "quality" && (week.deload || strength === "legs") ? "Rolig" : d.runLabel,
      km,
      strengthLabel: strength === "legs" ? `Legs (${legsModeFor(date)})` : plan.strength[strength]?.title ?? strength,
    };
  });
}

export function todayPlan(iso) {
  const w = weekFor(iso);
  if (!w) return null;
  return w.days.find((d) => d.day === weekday(iso));
}

export function daysToRace(iso) {
  return daysBetween(iso, plan.race.date);
}

export function phaseIndex(iso) {
  // Grovt: hvilken fase vi er i, basert på måned.
  const [y, m] = iso.split("-").map(Number);
  if (y <= 2026) return 0;
  if (m <= 3) return 1;
  if (m <= 6) return 2;
  if (m <= 8) return 3;
  return 4;
}

/** Siste N uker (inkl. denne) med mål og faktisk km. */
export function recentWeeks(todayIso, runs, n = 8) {
  const thisMonday = mondayOf(todayIso);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(thisMonday, -7 * i);
    const end = addDays(start, 6);
    const p = plan.weeks.find((w) => w.start === start);
    const km = runs
      .filter((r) => r.date >= start && r.date <= end)
      .reduce((s, r) => s + r.km, 0);
    out.push({
      start,
      target: p?.km ?? null,
      deload: p?.deload ?? false,
      km: Math.round(km * 10) / 10,
      current: i === 0,
    });
  }
  return out;
}

/* ---------------- Tidsestimat ---------------- */

export function fmtMin(totalMin) {
  const m = Math.round(totalMin);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} t ${r} min` : `${h} t`;
}

/** Rolig tur / langtur: tid = km × tempo. Returnerer minutter (mid, lav, høy). */
export function estimateRun(kind, km) {
  const p = plan.paces[kind === "long" ? "long" : "easy"];
  return {
    mid: (km * p.sec) / 60,
    low: (km * p.low) / 60,
    high: (km * p.high) / 60,
    pace: p.sec,
  };
}

/** Terskeløkt: oppvarming + drag + pauser + nedjogg. Returnerer minutter og km. */
export function estimateThreshold(stepIndex) {
  const q = plan.runSessions.quality;
  const step = q.progression[stepIndex ?? q.currentStep] ?? q.progression[0];
  const pc = plan.paces;
  const workMin = step.reps * step.min;
  const pauseMin = ((step.reps - 1) * step.pauseSec) / 60;
  const easyMin = q.warmupMin + q.cooldownMin;
  const total = workMin + pauseMin + easyMin;
  const km =
    (workMin * 60) / pc.threshold.sec +
    (pauseMin * 60) / pc.recoveryJog.sec +
    (easyMin * 60) / pc.easy.sec;
  return { step, total, km: Math.round(km * 10) / 10 };
}

export const fmtPace = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/* ---------------- Benkrotasjon ---------------- */


/** Hvilken rotasjon (bench/pullup) som gjelder en styrketype. */
export const rotationKeyFor = (strength) =>
  Object.keys(plan.rotations).find((k) => plan.rotations[k].strength === strength) ?? null;

const isRotDay = (key, iso) => strengthFor(iso) === plan.rotations[key].strength;

/** Hvilken variant i rotasjonen gjelder en gitt dato (null før start / feil dag). */
export function rotationFor(key, iso) {
  if (!key || !isRotDay(key, iso)) return null;
  const { anchorDate, cycle } = plan.rotations[key];
  if (iso < anchorDate) return null;
  let count = 0;
  for (let d = anchorDate; d < iso; d = addDays(d, 1)) if (isRotDay(key, d)) count++;
  const pos = count + (plan.rotations[key].startIndex ?? 0);
  const index = pos % cycle.length;
  const round = Math.floor(pos / cycle.length) + 1;
  const rot = plan.rotations[key];
  // Hver n-te runde byttes steg 1 ut med en test
  if (rot.test && rot.testEvery && index === 0 && round % rot.testEvery === 0) {
    return { ...rot.test, index, round, isTest: true };
  }
  return { ...cycle[index], index, round };
}

/** De neste n øktene i en rotasjon fra og med datoen. */
export function upcomingRotation(key, fromIso, n = 8) {
  const out = [];
  const start = fromIso < plan.rotations[key].anchorDate ? plan.rotations[key].anchorDate : fromIso;
  for (let d = start; out.length < n; d = addDays(d, 1)) {
    const item = rotationFor(key, d);
    if (item) out.push({ date: d, item });
  }
  return out;
}

export const benchFor = (iso) => rotationFor("bench", iso);

/* ---------------- Sesong (historikk + kommende uker) ---------------- */

export function seasonWeeks(todayIso, runs, back = 7, ahead = 4) {
  const thisMonday = mondayOf(todayIso);
  const out = [];
  for (let i = -back; i <= ahead; i++) {
    const start = addDays(thisMonday, 7 * i);
    const end = addDays(start, 6);
    const idx = plan.weeks.findIndex((w) => w.start === start);
    const p = idx >= 0 ? plan.weeks[idx] : null;
    const km = i > 0 ? null : runs.filter((r) => r.date >= start && r.date <= end).reduce((s, r) => s + r.km, 0);
    out.push({
      start,
      number: idx >= 0 ? idx + 1 : null,
      target: p?.km ?? null,
      long: p?.long ?? null,
      deload: !!p?.deload,
      draft: !!p?.draft,
      km: km == null ? null : Math.round(km * 10) / 10,
      state: i < 0 ? "past" : i === 0 ? "now" : "future",
    });
  }
  return out;
}

/** Pulssone (1–5) for en puls. */
export function zoneOf(hr) {
  if (!hr) return null;
  const z = plan.athlete.zones.findIndex((z) => hr < z.max);
  return z === -1 ? 5 : z + 1;
}
