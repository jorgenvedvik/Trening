import { getRuns, stravaConfigured } from "../lib/strava";
import {
  plan,
  weekFor,
  todayPlan,
  daysToRace,
  phaseIndex,
  recentWeeks,
  estimateRun,
  estimateThreshold,
  fmtMin,
  fmtPace,
  benchFor,
  upcomingPushDays,
} from "../lib/plan";
import {
  osloToday,
  addDays,
  mondayOf,
  weekday,
  isoWeekNumber,
  shortDate,
  formatDuration,
  formatPace,
} from "../lib/time";

export const revalidate = 600; // hent Strava på nytt hvert 10. minutt

const fmtKm = (n) => (n == null ? "–" : n.toLocaleString("nb-NO", { maximumFractionDigits: 1 }));

// Tidsestimat for en planlagt løpedag
function runEstimate(d) {
  if (!d?.run || !d.km) return null;
  const e = estimateRun(d.run, d.km);
  return {
    mid: e.mid,
    text: `≈ ${fmtMin(e.mid)}`,
    sub: `${fmtPace(e.pace)}/km · ${fmtMin(e.low)}–${fmtMin(e.high)}`,
  };
}

function strengthText(d) {
  if (d.strength !== "push") return d.strengthLabel;
  const b = benchFor(d.date);
  return b ? `Push · ${b.short}` : d.strengthLabel;
}

export default async function Page() {
  const today = osloToday();
  const monday = mondayOf(today);
  const since = addDays(monday, -7 * 7);
  const { runs, source, updated, error } = await getRuns(since);

  const week = weekFor(today);
  const tPlan = todayPlan(today);
  const weekRuns = runs.filter((r) => r.date >= monday && r.date <= addDays(monday, 6));
  const weekKm = Math.round(weekRuns.reduce((s, r) => s + r.km, 0) * 10) / 10;
  const target = week?.km ?? null;
  const pct = target ? Math.min(100, Math.round((weekKm / target) * 100)) : 0;
  const remaining = target ? Math.max(0, Math.round((target - weekKm) * 10) / 10) : null;
  const history = recentWeeks(today, runs, 8);
  const maxBar = Math.max(...history.map((h) => Math.max(h.km, h.target ?? 0)), 10);
  const todayWd = weekday(today);
  const raceDays = daysToRace(today);
  const curPhase = phaseIndex(today);
  const thr = estimateThreshold();
  const todayBench = tPlan ? benchFor(tPlan.date) : null;
  const todayEst = runEstimate(tPlan);
  const weekMin = week ? week.days.reduce((s, d) => s + (runEstimate(d)?.mid ?? 0), 0) : 0;
  const pushList = upcomingPushDays(today, 8);
  const nextBench = pushList[0]?.bench;

  return (
    <main className="wrap">
      {/* ---------- Topp ---------- */}
      <header className="top">
        <div>
          <p className="eyebrow">
            Uke {isoWeekNumber(today)} · {shortDate(monday)}–{shortDate(addDays(monday, 6))}
          </p>
          <h1>Løpeplanen</h1>
        </div>
        <div className="race">
          <span className="race-num">{raceDays}</span>
          <span className="race-label">
            dager til {plan.race.name}
            <br />
            {shortDate(plan.race.date)} 2027 · mål {plan.race.goal}
          </span>
        </div>
      </header>

      {/* ---------- Hero: km denne uka + i dag ---------- */}
      <section className="hero">
        <article className="card km-card">
          <div className="card-head">
            <h2>Km denne uka</h2>
            {week && (
              <span className={`tag ${week.deload ? "tag-calm" : ""}`}>
                Planuke {week.number}
                {week.deload ? " · deload" : ""}
                {week.draft ? " · foreløpig" : ""}
              </span>
            )}
          </div>
          <div className="km-big">
            <span className="km-now">{fmtKm(weekKm)}</span>
            <span className="km-target">/ {fmtKm(target)} km</span>
          </div>
          <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <dl className="km-stats">
            <div>
              <dt>Igjen</dt>
              <dd>{fmtKm(remaining)} km</dd>
            </div>
            <div>
              <dt>Turer</dt>
              <dd>
                {weekRuns.length} av {week ? week.days.filter((d) => d.run).length : "–"}
              </dd>
            </div>
            <div>
              <dt>Langtur</dt>
              <dd>{week ? `${week.long} km` : "–"}</dd>
            </div>
            <div>
              <dt>Løpetid (est.)</dt>
              <dd>{week ? fmtMin(weekMin) : "–"}</dd>
            </div>
          </dl>
          {week?.note && <p className="muted small">{week.note}</p>}
        </article>

        <article className="card today-card">
          <div className="card-head">
            <h2>I dag</h2>
            <span className="tag">{tPlan?.name ?? ""}</span>
          </div>
          {tPlan ? (
            <>
              <div className="today-rows">
                <div className="today-row">
                  <span className="dot dot-strength" />
                  <div>
                    <p className="label">Styrke etter jobb</p>
                    <p className="value">{strengthText(tPlan)}</p>
                    {todayBench && (
                      <p className="sub">
                        {todayBench.name} · {todayBench.dose}
                      </p>
                    )}
                  </div>
                </div>
                <div className="today-row">
                  <span className={`dot ${tPlan.run ? "dot-run" : "dot-off"}`} />
                  <div>
                    <p className="label">Løping{tPlan.run && tPlan.run !== "long" ? " på kvelden" : ""}</p>
                    <p className="value">
                      {tPlan.run ? `${tPlan.runLabel} ${fmtKm(tPlan.km)} km` : "Ingen løping"}
                      {todayEst && <span className="est"> {todayEst.text}</span>}
                    </p>
                    {todayEst && (
                      <p className="sub">
                        {todayEst.sub}
                        {tPlan.run === "quality" && ` · terskel ${thr.step.label} ≈ ${fmtMin(thr.total)} (~${fmtKm(thr.km)} km)`}
                      </p>
                    )}
                  </div>
                </div>
                {tPlan.extra && (
                  <div className="today-row">
                    <span className="dot dot-check" />
                    <div>
                      <p className="label">Husk</p>
                      <p className="value">{tPlan.extra}</p>
                    </div>
                  </div>
                )}
              </div>
              {tPlan.run && (
                <ul className="points">
                  {plan.runSessions[tPlan.run].points.slice(0, 4).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="muted">Ingen planuke lagt inn for denne datoen ennå.</p>
          )}
        </article>
      </section>

      {/* ---------- Uka dag for dag ---------- */}
      {week && (
        <section className="section">
          <h2 className="section-title">Uka dag for dag</h2>
          <div className="week-grid">
            {week.days.map((d) => {
              const done = weekRuns.filter((r) => r.date === d.date);
              const doneKm = done.reduce((s, r) => s + r.km, 0);
              const isToday = d.day === todayWd;
              const past = d.date < today;
              return (
                <div key={d.day} className={`day ${isToday ? "day-today" : ""} ${past ? "day-past" : ""}`}>
                  <p className="day-name">
                    {d.name.slice(0, 3)} <span>{shortDate(d.date)}</span>
                  </p>
                  <p className="day-strength">{strengthText(d)}</p>
                  {d.run ? (
                    <>
                      <p className={`day-run ${d.run === "long" ? "day-long" : ""}`}>
                        {d.runLabel} · {fmtKm(d.km)} km
                      </p>
                      <p className="day-est">{runEstimate(d).text}</p>
                    </>
                  ) : (
                    <p className="day-run day-norun">—</p>
                  )}
                  {doneKm > 0 && <p className="day-done">✓ {fmtKm(Math.round(doneKm * 10) / 10)} km løpt</p>}
                  {d.extra && <p className="day-extra">{d.extra}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- Benkrotasjon ---------- */}
      <section className="section">
        <h2 className="section-title">Benkrotasjon</h2>
        <div className="bench-cycle">
          {plan.bench.cycle.map((b, i) => (
            <article
              key={b.key}
              className={`card bench-step bench-${b.intensity} ${nextBench?.index === i ? "bench-next" : ""}`}
            >
              <div className="bench-top">
                <span className="bench-n">{i + 1}</span>
                <span className={`tag bench-tag-${b.intensity}`}>{b.intensity}</span>
              </div>
              <h3 className="bench-name">{b.name}</h3>
              <p className="bench-dose">{b.dose}</p>
              <p className="muted small">{b.cue}</p>
              {nextBench?.index === i && (
                <p className="bench-flag">
                  {pushList[0].date === today ? "I dag" : `Neste: ${shortDate(pushList[0].date)}`}
                </p>
              )}
            </article>
          ))}
        </div>
        <div className="card bench-upcoming">
          <p className="label">Kommende push-dager</p>
          <ol className="bench-list">
            {pushList.map((p) => (
              <li key={p.date} className={p.date === today ? "bench-today" : ""}>
                <span className="bench-date">
                  {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"][weekday(p.date) - 1]} {shortDate(p.date)}
                </span>
                <span className={`bench-pill bench-tag-${p.bench.intensity}`}>
                  {p.bench.index + 1} · {p.bench.short}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Ukesvolum ---------- */}
      <section className="section">
        <h2 className="section-title">Siste 8 uker</h2>
        <div className="card">
          <div className="chart" aria-label="Ukentlige kilometer mot mål">
            {history.map((h) => {
              const hPct = (h.km / maxBar) * 100;
              const tPct = h.target ? (h.target / maxBar) * 100 : null;
              const hit = h.target && h.km >= h.target * 0.95;
              return (
                <div key={h.start} className="col" title={`${shortDate(h.start)}: ${h.km} km av ${h.target ?? "–"}`}>
                  <div className="col-area">
                    {tPct != null && <div className="col-target" style={{ bottom: `${tPct}%` }} />}
                    <div
                      className={`col-bar ${h.current ? "col-current" : hit ? "col-hit" : ""}`}
                      style={{ height: `${hPct}%` }}
                    />
                  </div>
                  <p className="col-val">{fmtKm(h.km)}</p>
                  <p className="col-lab">{shortDate(h.start)}</p>
                </div>
              );
            })}
          </div>
          <p className="legend">
            <span className="lg lg-bar" /> Løpt <span className="lg lg-hit" /> Mål nådd{" "}
            <span className="lg lg-target" /> Ukesmål
          </p>
        </div>
      </section>

      {/* ---------- Ukesmål-tabell ---------- */}
      <section className="section">
        <h2 className="section-title">Ukesmål</h2>
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Uke</th>
                <th>Fra</th>
                <th className="num">Km</th>
                <th className="num">Langtur</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plan.weeks.map((w, i) => (
                <tr key={w.start} className={w.start === monday ? "row-now" : w.start < monday ? "row-past" : ""}>
                  <td>{i + 1}</td>
                  <td className="nowrap">{shortDate(w.start)}</td>
                  <td className="num">{w.km}</td>
                  <td className="num">{w.long}</td>
                  <td>
                    {w.deload && <span className="tag tag-calm">deload</span>}{" "}
                    {w.draft && <span className="tag tag-ghost">foreløpig</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- Økter ---------- */}
      <section className="section">
        <h2 className="section-title">Løpeøktene</h2>
        <div className="grid-3">
          {["easy", "quality", "long"].map((k) => {
            const s = plan.runSessions[k];
            return (
              <article key={k} className="card">
                <h3>{s.title}</h3>
                {k !== "quality" && (
                  <p className="pace-line">
                    ~{fmtPace(plan.paces[k].sec)}/km i {plan.paces[k].label.toLowerCase()}
                  </p>
                )}
                {k === "quality" && (
                  <p className="pace-line">
                    Drag ~{fmtPace(plan.paces.threshold.sec)}/km · inkl. {s.warmupMin} min opp og {s.cooldownMin} min ned
                  </p>
                )}
                <ul className="points">
                  {s.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                {s.progression && (
                  <>
                    <p className="label mt">Progresjon</p>
                    <ol className="steps">
                      {s.progression.map((p, i) => {
                        const e = estimateThreshold(i);
                        const cur = i === s.currentStep;
                        return (
                          <li key={p.label} className={cur ? "step-now" : ""}>
                            {p.label}{" "}
                            <span className="muted">
                              · ≈ {fmtMin(e.total)}, ~{fmtKm(e.km)} km
                            </span>
                            {cur && <span className="tag step-tag">nå</span>}
                          </li>
                        );
                      })}
                    </ol>
                    <p className="muted small">{s.progressionRule}</p>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ---------- Styrke ---------- */}
      <section className="section">
        <h2 className="section-title">Styrkeplan</h2>
        <div className="strength">
          {["legs", "push", "pull"].map((k) => {
            const s = plan.strength[k];
            const open = tPlan && (tPlan.strength === k || (k === "pull" && tPlan.strength === "light-pull"));
            return (
              <details key={k} className="card details" open={open || undefined}>
                <summary>
                  <span>
                    <strong>{k === "legs" && week ? `Legs (${week.legsMode} uke)` : s.title}</strong>
                    <span className="muted small block">{s.subtitle}</span>
                  </span>
                  <span className="chev" aria-hidden>
                    ▾
                  </span>
                </summary>
                <ol className="slots">
                  {s.slots.map((slot, i) => (
                    <li key={slot.purpose}>
                      <p className="slot-head">
                        <span className="slot-n">{i + 1}</span>
                        {slot.purpose}
                        <span className="slot-dose">{slot.dose}</span>
                      </p>
                      <p className="slot-opts">
                        {slot.bench && nextBench ? (
                          <span>
                            {pushList[0].date === today ? "I dag" : "Neste"}: <strong>{nextBench.name}</strong> ·{" "}
                            {nextBench.dose}
                          </span>
                        ) : slot.options.map((o, j) => (
                          <span key={o}>
                            {j > 0 && <span className="or"> / </span>}
                            {o}
                          </span>
                        ))}
                      </p>
                    </li>
                  ))}
                </ol>
                {s.note && <p className="muted small">{s.note}</p>}
              </details>
            );
          })}
        </div>
      </section>

      {/* ---------- Kontrollpunkter + soner ---------- */}
      <section className="section grid-2">
        <div>
          <h2 className="section-title">Kontrollpunkter</h2>
          <div className="card">
            <ul className="checks">
              {plan.checkpoints.map((c) => (
                <li key={c.title}>
                  <strong>{c.title}</strong>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div>
          <h2 className="section-title">Pulssoner · maks {plan.athlete.maxHr}</h2>
          <div className="card">
            <ul className="zones">
              {plan.athlete.zones.map((z, i) => (
                <li key={z.zone} className={`z z${i + 1}`}>
                  <span className="z-name">{z.zone}</span>
                  <span className="z-range">
                    {z.min}–{z.max}
                  </span>
                  <span className="z-use">{z.use}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Veien mot maraton ---------- */}
      <section className="section">
        <h2 className="section-title">Veien mot {plan.race.name}</h2>
        <ol className="phases">
          {plan.phases.map((p, i) => (
            <li key={p.label} className={i === curPhase ? "phase-now" : i < curPhase ? "phase-past" : ""}>
              <p className="phase-label">{p.label}</p>
              <p className="phase-text">{p.text}</p>
            </li>
          ))}
        </ol>
        <p className="muted small">{plan.race.note}</p>
      </section>

      {/* ---------- Siste turer ---------- */}
      <section className="section">
        <h2 className="section-title">Siste løpeturer</h2>
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Dato</th>
                <th>Tur</th>
                <th className="num">Km</th>
                <th className="num hide-sm">Tempo</th>
                <th className="num hide-sm">Hm</th>
                <th className="num">Kadens</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 10).map((r) => (
                <tr key={`${r.date}-${r.name}`}>
                  <td className="nowrap">{shortDate(r.date)}</td>
                  <td>
                    {r.name}
                    <span className="muted small block">
                      {formatDuration(r.movingTime)}
                      {r.avgHr ? ` · ${r.avgHr} bpm` : ""}
                    </span>
                  </td>
                  <td className="num">{fmtKm(r.km)}</td>
                  <td className="num hide-sm nowrap">{formatPace(r.movingTime, r.km)}</td>
                  <td className="num hide-sm">{r.elevation}</td>
                  <td className={`num ${r.cadence && r.cadence < 165 ? "warn" : ""}`}>{r.cadence ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="foot">
        {source === "strava" ? (
          <p>
            <span className="live" /> Live fra Strava · oppdateres hvert 10. min
          </p>
        ) : (
          <p>
            Viser lagrede data fra {updated}.{" "}
            {stravaConfigured() ? (
              <>Strava svarte ikke ({error}).</>
            ) : (
              <a href="/api/strava/connect">Koble til Strava for live km →</a>
            )}
          </p>
        )}
        <p className="muted">Planen ligger i data/plan.json – be Claude oppdatere den.</p>
      </footer>
    </main>
  );
}
