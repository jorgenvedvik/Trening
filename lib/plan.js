import plan from "../data/plan.json";
import { addDays, daysBetween, mondayOf, weekday } from "./time";

export { plan };

const round05 = (x) => Math.round(x * 2) / 2;

/** Finn planuka som inneholder datoen. Returnerer null utenfor planen. */
export function weekFor(iso) {
  const monday = mondayOf(iso);
  const idx = plan.weeks.findIndex((w) => w.start === monday);
  if (idx === -1) return null;
  const w = plan.weeks[idx];
  const number = idx + 1;
  const legsMode = w.deload || number % 2 === 0 ? "moderat" : "tung";
  return { ...w, number, end: addDays(w.start, 6), legsMode, days: dayPlan(w, number, legsMode) };
}

/** Fordel ukas km på løpedagene. */
function dayPlan(week, number, legsMode) {
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
    return {
      ...d,
      date: addDays(week.start, d.day - 1),
      run: active ? d.run : null,
      km,
      strengthLabel:
        d.strength === "legs"
          ? `Legs (${legsMode})`
          : plan.strength[d.strength]?.title ?? d.strength,
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

const pushDays = new Set(plan.weekTemplate.filter((d) => d.strength === "push").map((d) => d.day));

export function isPushDay(iso) {
  return pushDays.has(weekday(iso));
}

/** Hvilken benkvariant gjelder en gitt push-dag. */
export function benchFor(iso) {
  if (!isPushDay(iso)) return null;
  const { anchorDate, cycle } = plan.bench;
  if (iso < anchorDate) return null; // rotasjonen startet på anchorDate
  let count = 0;
  if (iso >= anchorDate) {
    for (let d = anchorDate; d < iso; d = addDays(d, 1)) if (isPushDay(d)) count++;
  } else {
    for (let d = iso; d < anchorDate; d = addDays(d, 1)) if (isPushDay(d)) count--;
  }
  const idx = ((count % cycle.length) + cycle.length) % cycle.length;
  return { ...cycle[idx], index: idx };
}

/** De neste n push-dagene fra og med datoen. */
export function upcomingPushDays(fromIso, n = 8) {
  const out = [];
  for (let d = fromIso; out.length < n; d = addDays(d, 1)) {
    if (isPushDay(d)) out.push({ date: d, bench: benchFor(d) });
  }
  return out;
}

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
