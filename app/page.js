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
  rotationFor,
  strengthFor,
  legsModeFor,
  rotationKeyFor,
  upcomingRotation,
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
  { id: "rotasjon", label: "Rotasjon" },
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

function Level({ n, label }) {
  return (
    <span className="lvl" aria-label={`Belastning ${n} av 3`}>
      <span className="lvl-bars" aria-hidden>
        {[1, 2, 3].map((i) => (
          <i key={i} className={i <= n ? "on" : ""} />
        ))}
      </span>
      {label && <span className="lvl-l">{label}</span>}
    </span>
  );
}

const STR_SHORT = { push: "Push", pull: "Pull" };

function strengthText(d) {
  const r = rotationFor(rotationKeyFor(d.strength), d.date);
  return r ? `${STR_SHORT[d.strength]} · ${r.name}` : d.strengthLabel;
}

/** Én rotasjon: neste økt → bane med fire steg → kalender. */
function RotationBlock({ rkey, today }) {
  const rot = plan.rotations[rkey];
  const list = upcomingRotation(rkey, today, 7);
  const next = list[0];
  if (!next) return null;
  const started = today >= rot.anchorDate;
  const nextTest = rot.testEvery ? upcomingRotation(rkey, today, rot.testEvery * rot.cycle.length + 1).find((x) => x.item.isTest) : null;
  return (
    <div className="rot-block">
      <h3 className="rot-h">{rot.title}</h3>
      <div className="bk">
        <article className="bk-next">
          <p className="eyebrow">
            {next.date === today
              ? "I dag"
              : `${started ? "Neste" : "Starter"} ${rot.noun} · ${DAY_LONG[weekday(next.date) - 1].toLowerCase()} ${shortDate(next.date)}`}
          </p>
          <h4 className="bk-name">{next.item.name}</h4>
          <p className="bk-dose">{next.item.dose}</p>
          <p className="bk-cue">{next.item.cue}</p>
          <Level n={next.item.level} label={next.item.intensity} />
          <span className="bk-num" aria-hidden>
            {String(next.item.index + 1).padStart(2, "0")}
          </span>
        </article>
        <div className="bk-side">
          <div className="card bk-track-card">
            <p className="eyebrow">Rotasjonen</p>
            <ol className="bk-track">
              {rot.cycle.map((c, i) => (
                <li key={c.key} className={i === next.item.index ? "on" : ""}>
                  <span className="bk-step">{i + 1}</span>
                  <span className="bk-tag">{c.tag}</span>
                  <Level n={c.level} />
                </li>
              ))}
            </ol>
            {nextTest && (
              <p className="bk-test">
                <span className="bk-test-k">1RM-test</span>
                {nextTest.date === today ? "i dag" : `${DAY_LONG[weekday(nextTest.date) - 1].toLowerCase()} ${shortDate(nextTest.date)}`} · hver {rot.testEvery}. runde, i stedet for steg 1
              </p>
            )}
          </div>
          <div className="card bk-cal">
            <p className="eyebrow">Deretter</p>
            <ol>
              {list.slice(1, 7).map((p) => (
                <li key={p.date}>
                  <span className="bk-d">
                    {DAY_SHORT[weekday(p.date) - 1]} {shortDate(p.date)}
                  </span>
                  <span className="bk-v">{p.item.name}</span>
                  <Level n={p.item.level} />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
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
  const tBench = tPlan ? rotationFor(rotationKeyFor(tPlan.strength), tPlan.date) : null;
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
  const nextRot = Object.fromEntries(Object.keys(plan.rotations).map((k) => [k, upcomingRotation(k, today, 1)[0]]));
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
                  <p className="tb-k">Styrke{todayWd <= 5 ? " · etter jobb" : ""}</p>
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

        {/* ---------- Rotasjoner ---------- */}
        <section id="rotasjon" className="sec anchor">
          <div className="sec-head">
            <h2>Rotasjon</h2>
            <p>Fast rekkefølge, fire steg. Benk på push-dager, pullups på pull-dager – hver tredje dag.</p>
          </div>
          <div className="rots">
            {Object.keys(plan.rotations).map((k) => (
              <RotationBlock key={k} rkey={k} today={today} />
            ))}
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
              const nextDay = (() => {
                for (let d = today, i = 0; i < 4; i++, d = addDays(d, 1)) if (strengthFor(d) === k) return d;
              })();
              const days = [nextDay === today ? "I dag" : `Neste ${DAY_SHORT[weekday(nextDay) - 1].toLowerCase()} ${shortDate(nextDay)}`];
              return (
                <details key={k} className={`card str-c ${isToday ? "str-now" : ""}`} open={isToday || undefined}>
                  <summary>
                    <div>
                      <p className="str-title">
                        {k === "legs" ? `Legs · ${legsModeFor(nextDay)}` : s.title}
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
                            {slot.rotation && nextRot[slot.rotation] ? (
                              <>
                                <b>{nextRot[slot.rotation].item.name}</b> ·{" "}
                                {nextRot[slot.rotation].date === today ? "i dag" : `neste ${shortDate(nextRot[slot.rotation].date)}`}
                              </>
                            ) : (
                              slot.options.join(" / ")
                            )}
                          </p>
                        </div>
                        <span className="slot-d">{slot.rotation && nextRot[slot.rotation] ? nextRot[slot.rotation].item.dose : slot.dose}</span>
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
              <p className="eyebrow">{["Null", "Én", "To", "Tre", "Fire", "Fem"][plan.checkpoints.length] ?? plan.checkpoints.length} regler</p>
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
              <span className="live" /> Live fra Strava
            </p>
          ) : (
            <p>
              Viser lagrede data fra {updated}.{" "}
              {stravaConfigured() ? <>Strava svarte ikke ({error}).</> : <a href="/api/strava/connect">Koble til Strava →</a>}
            </p>
          )}
        </footer>
      </main>
    </>
  );
}
