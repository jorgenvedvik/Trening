import { getRuns, stravaConfigured } from "../lib/strava";
import {
  plan,
  weekFor,
  todayPlan,
  daysToRace,
  phaseIndex,
  estimateRun,
  estimateThreshold,
  fmtMin,
  fmtPace,
  benchFor,
  upcomingPushDays,
  seasonWeeks,
  zoneOf,
} from "../lib/plan";
import { osloToday, addDays, mondayOf, weekday, isoWeekNumber, shortDate, formatDuration, formatPace } from "../lib/time";
import { fmtKm, DAY_SHORT, DAY_LONG } from "../lib/format";
import { coachLine, paceStatus } from "../lib/coach";
import { CountUp, SectionNav, WeekSwitch } from "./ui";

export const revalidate = 600; // hent Strava på nytt hvert 10. minutt

const RUN_ZONE = { easy: 2, long: 2, quality: 4 };

const NAV = [
  { id: "idag", label: "I dag" },
  { id: "uka", label: "Uka" },
  { id: "benk", label: "Benk" },
  { id: "styrke", label: "Styrke" },
  { id: "sesong", label: "Sesong" },
  { id: "okter", label: "Øktene" },
  { id: "turer", label: "Turer" },
];

function runEst(d) {
  if (!d?.run || !d.km) return null;
  const e = estimateRun(d.run, d.km);
  return { mid: e.mid, low: e.low, high: e.high, pace: e.pace };
}

function strengthText(d) {
  if (d.strength !== "push") return d.strengthLabel;
  const b = benchFor(d.date);
  return b ? `Push · ${b.name}` : d.strengthLabel;
}

export default async function Page() {
  const today = osloToday();
  const monday = mondayOf(today);
  const { runs, source, updated, error } = await getRuns(addDays(monday, -7 * 7));

  const week = weekFor(today);
  const tPlan = todayPlan(today);
  const weekRuns = runs.filter((r) => r.date >= monday && r.date <= addDays(monday, 6));
  const weekKm = Math.round(weekRuns.reduce((s, r) => s + r.km, 0) * 10) / 10;
  const target = week?.km ?? null;
  const remaining = target ? Math.max(0, target - weekKm) : null;

  const todaysRuns = runs.filter((r) => r.date === today);
  const doneToday = todaysRuns.length > 0;
  const doneTodayKm = todaysRuns.reduce((s, r) => s + r.km, 0);

  // Forventet km så langt i uka (dager som er passert + i dag hvis løpt)
  const expected = week
    ? week.days.filter((d) => d.run && (d.date < today || (d.date === today && doneToday))).reduce((s, d) => s + d.km, 0)
    : null;
  const status = week ? paceStatus(weekKm - expected) : null;

  const coach = coachLine({ tPlan, doneToday, doneTodayKm, week });
  const tEst = runEst(tPlan);
  const thr = estimateThreshold();
  const tBench = tPlan ? benchFor(tPlan.date) : null;
  const weekMin = week ? week.days.reduce((s, d) => s + (runEst(d)?.mid ?? 0), 0) : 0;
  const runDays = week ? week.days.filter((d) => d.run) : [];
  const maxDayKm = Math.max(...(week?.days.map((d) => d.km ?? 0) ?? [0]), ...weekRuns.map((r) => r.km), 1);

  const todayWd = weekday(today);
  // Uker man kan bla i: forrige, denne og fire fram
  const OFFSET_LABEL = { "-1": "Forrige uke", 0: "Denne uka", 1: "Neste uke" };
  const weekViews = [-1, 0, 1, 2, 3, 4]
    .map((o) => ({ offset: o, week: weekFor(addDays(monday, 7 * o)) }))
    .filter((v) => v.week)
    .map((v) => ({
      ...v,
      label: OFFSET_LABEL[v.offset] ?? `Om ${v.offset} uker`,
      maxKm: Math.max(
        ...v.week.days.map((d) => d.km ?? 0),
        ...runs.filter((r) => r.date >= v.week.start && r.date <= v.week.end).map((r) => r.km),
        1
      ),
    }));
  // På søndag er uka i praksis ferdig – vis neste uke først
  const defaultOffset = todayWd === 7 && weekViews.some((v) => v.offset === 1) ? 1 : 0;

  const nextWeek = weekFor(addDays(monday, 7));
  const nextRun =
    [...(week?.days ?? []), ...(nextWeek?.days ?? [])].find(
      (d) => d.run && (d.date > today || (d.date === today && !doneToday))
    ) ?? null;
  const pushList = upcomingPushDays(today, 8);
  const nextBench = pushList[0];
  const season = seasonWeeks(today, runs, 7, 4);
  const seasonMax = Math.max(...season.map((s) => Math.max(s.km ?? 0, s.target ?? 0)), 10);
  const raceDays = daysToRace(today);
  const curPhase = phaseIndex(today);

  return (
    <>
      {/* ---------- Topplinje ---------- */}
      <header className="bar">
        <div className="bar-in">
          <a href="#idag" className="logo" aria-label="PULS – til toppen">
            <span className="logo-mark" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            PULS
          </a>
          <SectionNav items={NAV} />
          <div className="count" title={`${plan.race.name} ${plan.race.date}`}>
            <b>{raceDays}</b>
            <span>
              dager til
              <br />
              {plan.race.name}
            </span>
          </div>
        </div>
      </header>

      <main className="wrap">
        {/* ---------- I dag ---------- */}
        <section id="idag" className="hero anchor">
          <article className="today rise" style={{ "--i": 0 }}>
            <p className="eyebrow">
              {DAY_LONG[todayWd - 1]} {shortDate(today)} · uke {isoWeekNumber(today)}
            </p>
            <h1 className="today-head">{coach.head}</h1>
            <p className="today-body">{coach.body}</p>

            <div className="today-blocks">
              {tPlan && (
                <div className="tb">
                  <p className="tb-k">Styrke · etter jobb</p>
                  <p className="tb-v">{tBench ? tBench.name : tPlan.strengthLabel}</p>
                  <p className="tb-s">{tBench ? tBench.dose : " "}</p>
                </div>
              )}
              {tPlan?.run ? (
                <div className={`tb ${doneToday ? "tb-done" : ""}`}>
                  <p className="tb-k">Løping · {tPlan.run === "long" ? "på dagtid" : "på kvelden"}</p>
                  <p className="tb-v">
                    {doneToday ? `✓ ${fmtKm(doneTodayKm)} km` : `${fmtKm(tPlan.km)} km`}
                    {!doneToday && tEst && <span className="tb-time"> ≈ {fmtMin(tEst.mid)}</span>}
                  </p>
                  <p className="tb-s">
                    {doneToday
                      ? [
                          formatDuration(todaysRuns.reduce((s, r) => s + r.movingTime, 0)),
                          formatPace(todaysRuns.reduce((s, r) => s + r.movingTime, 0), doneTodayKm),
                          todaysRuns[0]?.avgHr ? `snittpuls ${todaysRuns[0].avgHr}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : tPlan.run === "quality"
                      ? `eller terskel ${thr.step.label} ≈ ${fmtMin(thr.total)}`
                      : `${fmtPace(tEst.pace)}/km · sone 2 · under 160`}
                  </p>
                </div>
              ) : (
                <div className="tb tb-off">
                  <p className="tb-k">Løping</p>
                  <p className="tb-v">Fri</p>
                  <p className="tb-s">{tPlan?.extra ?? "Beina hviler"}</p>
                </div>
              )}
            </div>
          </article>

          <article className="km card rise" style={{ "--i": 1 }}>
            <div className="km-top">
              <p className="eyebrow">Km denne uka</p>
              {week && (
                <span className={`chip ${week.deload ? "chip-calm" : ""}`}>
                  <span>
                    Planuke {week.number}
                    {week.deload ? " · deload" : ""}
                  </span>
                </span>
              )}
            </div>
            <p className="km-num">
              <span className="km-now">
                <CountUp value={weekKm} />
              </span>
              <span className="km-of">/ {fmtKm(target)}</span>
            </p>

            {/* Segmentert fremdrift: én skrå blokk per løpedag, bredde = planlagte km */}
            <div className="segs" aria-label={`${fmtKm(weekKm)} av ${fmtKm(target)} km`}>
              {runDays.map((d, i) => {
                const got = weekRuns.filter((r) => r.date === d.date).reduce((s, r) => s + r.km, 0);
                const fill = Math.min(1, got / d.km);
                return (
                  <div key={d.day} className="seg" style={{ flexGrow: d.km, "--i": i }}>
                    <div className="seg-track">
                      <div className={`seg-fill ${d.date === today ? "seg-today" : ""}`} style={{ "--f": fill }} />
                    </div>
                    <span className="seg-lab">
                      {DAY_SHORT[d.day - 1]} <em>{fmtKm(d.km)}</em>
                    </span>
                  </div>
                );
              })}
            </div>

            <dl className="km-stats">
              <div>
                <dt>Igjen</dt>
                <dd>{fmtKm(remaining)} km</dd>
              </div>
              <div>
                <dt>Turer</dt>
                <dd>
                  {weekRuns.length}/{runDays.length}
                </dd>
              </div>
              <div>
                <dt>Løpetid</dt>
                <dd>≈ {fmtMin(weekMin)}</dd>
              </div>
            </dl>
            {status && <p className={`status status-${status.tone}`}>{status.text}</p>}
            {nextRun && (
              <p className="next">
                <span className="eyebrow">{nextRun.date === today ? "I kveld" : "Neste tur"}</span>
                <b>
                  {nextRun.date === today ? "" : `${DAY_SHORT[nextRun.day - 1]}${nextRun.date > addDays(monday, 6) ? " " + shortDate(nextRun.date) : ""} · `}
                  {nextRun.runLabel} {fmtKm(nextRun.km)} km
                </b>
                <span>≈ {fmtMin(runEst(nextRun).mid)}</span>
              </p>
            )}
          </article>
        </section>

        {/* ---------- Uka (bla mellom uker) ---------- */}
        {weekViews.length > 0 && (
          <section id="uka" className="sec anchor">
            <WeekSwitch
              initial={weekViews.findIndex((v) => v.offset === defaultOffset)}
              weeks={weekViews.map((v) => ({
                key: v.week.start,
                label: v.label,
                sub: `${shortDate(v.week.start)}–${shortDate(v.week.end)} · ${v.week.km} km · langtur ${v.week.long} km${v.week.deload ? " · deload" : ""}${v.week.draft ? " · foreløpig" : ""}`,
                content: (
                  <ol className="week">
                    {v.week.days.map((d, i) => {
                      const got = runs.filter((r) => r.date === d.date).reduce((s, r) => s + r.km, 0);
                      const est = runEst(d);
                      const isToday = d.date === today;
                      const past = d.date < today;
                      const z = d.run ? RUN_ZONE[d.run] : null;
                      return (
                        <li key={d.day} className={`day rise ${isToday ? "day-now" : ""} ${past ? "day-past" : ""}`} style={{ "--i": i }}>
                          <div className="day-meta">
                            <p className="day-name">{DAY_SHORT[d.day - 1]}</p>
                            <p className="day-date">{shortDate(d.date)}</p>
                          </div>
                          <div className="day-gauge" aria-hidden>
                            {d.km > 0 && <div className="g-plan" style={{ "--h": d.km / v.maxKm }} />}
                            {got > 0 && <div className="g-done" style={{ "--h": got / v.maxKm, "--i": i }} />}
                          </div>
                          <div className="day-body">
                            <p className="day-str">{strengthText(d)}</p>
                            {d.run ? (
                              <p className={`day-run z${z}`}>
                                <span className="zdot" />
                                {d.runLabel} {fmtKm(d.km)} km
                                {est && <span className="day-est"> · ≈ {fmtMin(est.mid)}</span>}
                              </p>
                            ) : (
                              <p className="day-run day-off">{d.extra ?? "Ingen løping"}</p>
                            )}
                            {got > 0 && <p className="day-done">✓ {fmtKm(got)} km løpt</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ),
              }))}
            />
          </section>
        )}

        {/* ---------- Benkrotasjon ---------- */}
        <section id="benk" className="sec anchor">
          <div className="sec-head">
            <h2>Benkrotasjon</h2>
            <p>Fire varianter på rad, én per push-dag. Mandag og torsdag.</p>
          </div>
          <div className="bench card">
            <ol className="rot">
              {plan.bench.cycle.map((b, i) => (
                <li key={b.key} className={`rot-step rot-${b.intensity} ${nextBench?.bench.index === i ? "rot-on" : ""}`}>
                  <div className="rot-top">
                    <span className="rot-n">{String(i + 1).padStart(2, "0")}</span>
                    <span className="rot-int">
                      <span>{nextBench?.bench.index === i ? (nextBench.date === today ? "I dag" : "Neste") : b.intensity}</span>
                    </span>
                  </div>
                  <p className="rot-name">{b.name}</p>
                  <p className="rot-dose">{b.dose}</p>
                  <p className="rot-cue">{b.cue}</p>
                </li>
              ))}
            </ol>
            <div className="upc">
              <p className="eyebrow">Neste push-dager</p>
              <ol className="upc-list">
                {pushList.map((p) => (
                  <li key={p.date} className={`upc-i rot-${p.bench.intensity} ${p.date === today ? "upc-now" : ""}`}>
                    <span className="upc-d">
                      {DAY_SHORT[weekday(p.date) - 1]} {shortDate(p.date)}
                    </span>
                    <span className="upc-b">
                      <i>{p.bench.index + 1}</i>
                      {p.bench.name}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ---------- Styrke ---------- */}
        <section id="styrke" className="sec anchor">
          <div className="sec-head">
            <h2>Styrke</h2>
            <p>Én slot = ett formål. Velg det alternativet gymmen har ledig.</p>
          </div>
          <div className="str">
            {["legs", "push", "pull"].map((k) => {
              const s = plan.strength[k];
              const isToday = tPlan && (tPlan.strength === k || (k === "pull" && tPlan.strength === "light-pull"));
              const days = plan.weekTemplate.filter((d) => d.strength === k).map((d) => DAY_SHORT[d.day - 1]);
              return (
                <details key={k} className={`card str-c ${isToday ? "str-now" : ""}`} open={isToday || undefined}>
                  <summary>
                    <div>
                      <p className="str-title">
                        {k === "legs" && week ? `Legs · ${week.legsMode}` : s.title}
                        {isToday && <span className="now-tag">I dag</span>}
                      </p>
                      <p className="str-sub">
                        {days.join(" + ")} · {s.slots.length} slots
                      </p>
                    </div>
                    <span className="chev" aria-hidden />
                  </summary>
                  <p className="str-note">{s.subtitle}</p>
                  <ol className="slots">
                    {s.slots.map((slot, i) => (
                      <li key={slot.purpose}>
                        <span className="slot-n">{i + 1}</span>
                        <div>
                          <p className="slot-p">{slot.purpose}</p>
                          <p className="slot-o">
                            {slot.bench && nextBench ? (
                              <>
                                <b>{nextBench.bench.name}</b> · {nextBench.date === today ? "i dag" : `neste ${shortDate(nextBench.date)}`}
                              </>
                            ) : (
                              slot.options.join(" / ")
                            )}
                          </p>
                        </div>
                        <span className="slot-d">{slot.bench && nextBench ? nextBench.bench.dose : slot.dose}</span>
                      </li>
                    ))}
                  </ol>
                  {s.note && <p className="str-note">{s.note}</p>}
                </details>
              );
            })}
          </div>
        </section>

        {/* ---------- Sesong ---------- */}
        <section id="sesong" className="sec anchor">
          <div className="sec-head">
            <h2>Sesongen</h2>
            <p>Faktiske km mot ukesmålet – og ukene som kommer.</p>
          </div>
          <div className="card season">
            <div className="chart">
              {season.map((w, i) => {
                const hit = w.target && w.km != null && w.km >= w.target * 0.95;
                return (
                  <div key={w.start} className={`col col-${w.state}`} title={`Uke fra ${shortDate(w.start)}: ${w.km ?? "–"} av ${w.target ?? "–"} km`}>
                    <div className="col-area">
                      {w.target && w.state === "future" && <div className="col-ghost" style={{ "--h": w.target / seasonMax }} />}
                      {w.km != null && (
                        <div className={`col-b ${w.state === "now" ? "col-bn" : hit ? "col-bh" : ""}`} style={{ "--h": w.km / seasonMax, "--i": i }} />
                      )}
                      {w.target && w.state !== "future" && <div className="col-t" style={{ "--h": w.target / seasonMax }} />}
                    </div>
                    <p className="col-v">{w.km != null ? fmtKm(w.km) : w.target ?? "–"}</p>
                    <p className="col-l">
                      {shortDate(w.start)}
                      {w.deload && <i className="col-dl">D</i>}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="legend">
              <span><i className="lg lg-h" /> Mål nådd</span>
              <span><i className="lg lg-b" /> Under mål</span>
              <span><i className="lg lg-n" /> Denne uka</span>
              <span><i className="lg lg-g" /> Kommende mål</span>
              <span><i className="lg-d">D</i> Deload</span>
            </p>

            <ol className="phases">
              {plan.phases.map((p, i) => (
                <li key={p.label} className={i === curPhase ? "ph-now" : i < curPhase ? "ph-past" : ""}>
                  <p className="ph-l">{p.label}</p>
                  <p className="ph-t">{p.text}</p>
                </li>
              ))}
            </ol>

            <details className="tbl">
              <summary>Alle ukesmål</summary>
              <table>
                <thead>
                  <tr>
                    <th>Uke</th>
                    <th>Fra</th>
                    <th className="num">Km</th>
                    <th className="num">Langtur</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {plan.weeks.map((w, i) => (
                    <tr key={w.start} className={w.start === monday ? "tr-now" : w.start < monday ? "tr-past" : ""}>
                      <td>{i + 1}</td>
                      <td className="nowrap">{shortDate(w.start)}</td>
                      <td className="num">{w.km}</td>
                      <td className="num">{w.long}</td>
                      <td className="tags">
                        {w.deload && (
                          <span className="chip chip-calm">
                            <span>deload</span>
                          </span>
                        )}{" "}
                        {w.draft && (
                          <span className="chip chip-ghost">
                            <span>foreløpig</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        </section>

        {/* ---------- Øktene + soner ---------- */}
        <section id="okter" className="sec anchor">
          <div className="sec-head">
            <h2>Øktene</h2>
            <p>Pulsen styrer. Farten er bare et resultat.</p>
          </div>
          <div className="sessions">
            {["easy", "quality", "long"].map((k) => {
              const s = plan.runSessions[k];
              return (
                <article key={k} className={`card ses z${RUN_ZONE[k]}`}>
                  <p className="ses-z">
                    <span className="zdot" />
                    Sone {RUN_ZONE[k]}
                  </p>
                  <h3>{s.title.replace(" (når det står på planen)", "")}</h3>
                  <p className="ses-pace">
                    {k === "quality"
                      ? `Drag ~${fmtPace(plan.paces.threshold.sec)}/km · ${s.warmupMin} min opp, ${s.cooldownMin} min ned`
                      : `~${fmtPace(plan.paces[k].sec)}/km`}
                  </p>
                  <ul className="pts">
                    {s.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  {s.progression && (
                    <ol className="prog">
                      {s.progression.map((p, i) => {
                        const e = estimateThreshold(i);
                        return (
                          <li key={p.label} className={i === s.currentStep ? "prog-now" : i < s.currentStep ? "prog-done" : ""}>
                            <span className="prog-l">{p.label}</span>
                            <span className="prog-t">≈ {fmtMin(e.total)}</span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </article>
              );
            })}
          </div>

          <div className="rules">
            <article className="card">
              <p className="eyebrow">Pulssoner · maks {plan.athlete.maxHr}</p>
              <div className="zbar" aria-hidden>
                {plan.athlete.zones.map((z, i) => (
                  <span key={z.zone} className={`zb z${i + 1}`} style={{ flexGrow: z.max - z.min }} />
                ))}
              </div>
              <ul className="zones">
                {plan.athlete.zones.map((z, i) => (
                  <li key={z.zone} className={`z${i + 1}`}>
                    <span className="zdot" />
                    <b>{z.zone}</b>
                    <span className="zr">
                      {z.min}–{z.max}
                    </span>
                    <span className="zu">{z.use}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="card">
              <p className="eyebrow">Fire regler</p>
              <ol className="checks">
                {plan.checkpoints.map((c, i) => (
                  <li key={c.title}>
                    <span className="ck-n">{i + 1}</span>
                    <div>
                      <b>{c.title}</b>
                      <p>{c.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          </div>
        </section>

        {/* ---------- Turer ---------- */}
        <section id="turer" className="sec anchor">
          <div className="sec-head">
            <h2>Siste turer</h2>
            <p>Prikken viser sonen for snittpulsen. Kadens under 165 er markert.</p>
          </div>
          <ol className="runs card">
            <li className="run run-h" aria-hidden>
              <span>Dato</span>
              <span>Tur</span>
              <span className="r">Puls</span>
              <span className="r">Kadens</span>
              <span className="r">Km</span>
            </li>
            {runs.slice(0, 10).map((r) => {
              const z = zoneOf(r.avgHr);
              return (
                <li key={`${r.date}-${r.name}`} className="run">
                  <span className="run-d">{shortDate(r.date)}</span>
                  <div className="run-n">
                    <p>{r.name}</p>
                    <span>
                      {formatDuration(r.movingTime)} · {formatPace(r.movingTime, r.km)}
                      {r.elevation ? ` · ${r.elevation} hm` : ""}
                    </span>
                  </div>
                  <span className={`run-hr ${z ? `z${z}` : ""}`}>
                    {z && <span className="zdot" />}
                    {r.avgHr ?? "–"}
                  </span>
                  <span className={`run-c ${r.cadence && r.cadence < 165 ? "low" : ""}`}>{r.cadence ?? "–"}</span>
                  <span className="run-km">
                    {fmtKm(r.km)}
                    <small> km</small>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <footer className="foot">
          {source === "strava" ? (
            <p>
              <span className="live" /> Live fra Strava · oppdateres hvert 10. min
            </p>
          ) : (
            <p>
              Viser lagrede data fra {updated}.{" "}
              {stravaConfigured() ? <>Strava svarte ikke ({error}).</> : <a href="/api/strava/connect">Koble til Strava →</a>}
            </p>
          )}
          <p>
            {plan.race.name} {shortDate(plan.race.date)} 2027 · mål {plan.race.goal} · planen ligger i data/plan.json
          </p>
        </footer>
      </main>
    </>
  );
}
