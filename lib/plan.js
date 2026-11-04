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
