"use client";

import { useEffect, useRef, useState } from "react";
import { sunTimes } from "../lib/sun";

const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Teller opp et tall ved lasting. Respekterer prefers-reduced-motion. */
export function CountUp({ value, decimals = 1, duration = 1100, delay = 150 }) {
  const fmt = (n) => n.toLocaleString("nb-NO", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  const [shown, setShown] = useState(fmt(value));
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf;
    let start;
    const tick = (t) => {
      if (!start) start = t + delay;
      const p = Math.max(0, Math.min(1, (t - start) / duration));
      setShown(fmt(Math.round(value * easeOutExpo(p) * 10 ** decimals) / 10 ** decimals));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setShown(fmt(0));
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{shown}</span>;
}

/** Sticky seksjonsnavigasjon som markerer seksjonen du står i. */
export function SectionNav({ items }) {
  const [active, setActive] = useState(items[0]?.id);
  const navRef = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    items.forEach((i) => {
      const el = document.getElementById(i.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [items]);

  // Hold aktiv lenke synlig i den horisontale lista på mobil
  useEffect(() => {
    const nav = navRef.current;
    const a = nav?.querySelector(`[data-id="${active}"]`);
    if (nav && a) nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  return (
    <nav className="snav" aria-label="Seksjoner" ref={navRef}>
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} data-id={i.id} className={active === i.id ? "on" : ""}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}

/** Bla mellom uker i ukevisningen. Innholdet for hver uke rendres på serveren. */
export function WeekSwitch({ weeks, initial = 0 }) {
  const [idx, setIdx] = useState(Math.max(0, initial));
  const w = weeks[idx];
  const go = (d) => setIdx((i) => Math.min(weeks.length - 1, Math.max(0, i + d)));
  return (
    <>
      <div className="sec-head wk-head">
        <div className="wk-title">
          <h2>{w.label}</h2>
          <p>{w.sub}</p>
        </div>
        <div className="wk-nav">
          <button type="button" className="wk-btn" onClick={() => go(-1)} disabled={idx === 0} aria-label="Forrige uke">
            ←
          </button>
          <div className="wk-dots" role="tablist" aria-label="Velg uke">
            {weeks.map((x, i) => (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={i === idx}
                className={`wk-dot ${i === idx ? "on" : ""}`}
                onClick={() => setIdx(i)}
                title={x.label}
              />
            ))}
          </div>
          <button type="button" className="wk-btn" onClick={() => go(1)} disabled={idx === weeks.length - 1} aria-label="Neste uke">
            →
          </button>
        </div>
      </div>
      <div key={w.key} className="wk-body">
        {w.content}
      </div>
    </>
  );
}

/** «Hvile i dag»-knapp med passord. Flytter styrkerekkefølgen én dag. */
export function RestButton({ date, isRest, enabled }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(false);
  const [state, setState] = useState({ busy: false, error: "" });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("puls-pw");
      if (saved) {
        setPw(saved);
        setRemember(true);
      }
    } catch {}
  }, []);

  if (!enabled) return null;

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, error: "" });
    try {
      const res = await fetch("/api/rest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, action: isRest ? "remove" : "add", password: pw }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ busy: false, error: json.error || "Noe gikk galt." });
        return;
      }
      try {
        if (remember) localStorage.setItem("puls-pw", pw);
        else localStorage.removeItem("puls-pw");
      } catch {}
      window.location.reload();
    } catch {
      setState({ busy: false, error: "Fikk ikke kontakt. Prøv igjen." });
    }
  }

  if (!open) {
    return (
      <button type="button" className="rest-btn" onClick={() => setOpen(true)}>
        {isRest ? "Angre hviledag" : "Hvile i dag – flytt planen"}
      </button>
    );
  }

  return (
    <form className="rest-form" onSubmit={submit}>
      <p className="rest-info">
        {isRest
          ? "Dagen blir en vanlig styrkedag igjen, og rekkefølgen flyttes tilbake."
          : "Styrkerekkefølgen og rotasjonene flyttes én dag fram. Løpingen står som før."}
      </p>
      <div className="rest-row">
        <input
          type="password"
          className="rest-pw"
          placeholder="Passord"
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
          required
        />
        <button type="submit" className="rest-go" disabled={state.busy || !pw}>
          {state.busy ? "Lagrer …" : isRest ? "Angre" : "Bekreft"}
        </button>
      </div>
      <label className="rest-remember">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Husk passordet på denne enheten
      </label>
      {state.error && <p className="rest-err">{state.error}</p>}
      <button type="button" className="rest-cancel" onClick={() => setOpen(false)}>
        Avbryt
      </button>
    </form>
  );
}

/** Konfetti av skrå blokker – én gang per uke, første gang siden åpnes etter at ukesmålet er nådd. */
export function GoalConfetti({ weekStart, reached, km }) {
  const [pieces, setPieces] = useState(null);
  useEffect(() => {
    if (!reached) return;
    const key = `split-goal-${weekStart}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return; // uten lagring: heller ingen feiring enn feiring hver gang
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["var(--signal)", "var(--volt)", "var(--ink)", "var(--signal)", "var(--volt)"];
    setPieces(
      Array.from({ length: 90 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.6 + Math.random() * 1.4,
        drift: (Math.random() - 0.5) * 220,
        rot: (Math.random() - 0.5) * 720,
        w: 6 + Math.random() * 8,
        h: 10 + Math.random() * 14,
        c: colors[i % colors.length],
      }))
    );
    const t = setTimeout(() => setPieces(null), 3600);
    return () => clearTimeout(t);
  }, [reached, weekStart]);

  if (!pieces) return null;
  return (
    <div className="confetti" aria-hidden>
      <p className="confetti-msg">
        <span>Ukesmålet er nådd · {km.toLocaleString("nb-NO", { maximumFractionDigits: 1 })} km</span>
      </p>
      {pieces.map((p) => (
        <i
          key={p.id}
          style={{
            left: `${p.x}%`,
            width: p.w,
            height: p.h,
            background: p.c,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            "--drift": `${p.drift}px`,
            "--rot": `${p.rot}deg`,
          }}
        />
      ))}
    </div>
  );
}

const osloHM = (d) => d.toLocaleTimeString("nb-NO", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit" });

/** Liten sol/måne midt i toppen: når går sola ned i Oslo i dag (eller opp i morgen)? */
export function SunChip() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <div className="sun" aria-hidden />;

  const today = sunTimes(now);
  const up = today.rise && today.set && now >= today.rise && now < today.set;
  let label, title, soon = false;
  if (up) {
    const min = Math.round((today.set - now) / 60000);
    soon = min <= 90;
    label = soon ? `Sola ned om ${min} min` : `Sola ned ${osloHM(today.set)}`;
    title = `Solnedgang i Oslo kl. ${osloHM(today.set)}`;
  } else {
    const next = now < (today.rise ?? now) ? today.rise : sunTimes(new Date(now.getTime() + 864e5)).rise;
    label = next ? `Sola opp ${osloHM(next)}` : "Mørketid";
    title = next ? `Soloppgang i Oslo kl. ${osloHM(next)}` : "Sola står ikke opp i dag";
  }

  return (
    <div className={`sun ${up ? "sun-day" : "sun-night"} ${soon ? "sun-soon" : ""}`} title={title}>
      {up ? (
        <svg className="sun-ic" viewBox="0 0 24 16" aria-hidden>
          <g className="sun-disc">
            <path d="M6.5 13a5.5 5.5 0 0 1 11 0Z" />
            <path className="sun-rays" d="M12 2.2v2.4M4.6 5.6l1.7 1.7M19.4 5.6l-1.7 1.7M1.6 11.4h2.3M20.1 11.4h2.3" />
          </g>
          <path className="sun-hz" d="M1 14.5h22" />
        </svg>
      ) : (
        <svg className="sun-ic" viewBox="0 0 24 16" aria-hidden>
          <path className="moon" d="M12.5 1a7 7 0 1 0 7.4 9.4 5.6 5.6 0 0 1-7.4-9.4Z" />
          <circle className="star" cx="19.6" cy="3" r="1" />
          <circle className="star s2" cx="23" cy="6.4" r=".7" />
        </svg>
      )}
      <span>{label}</span>
    </div>
  );
}

const osloParts = (d) => {
  const f = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};

/** Styrkefeltet i dagens kort. Regnes som gjennomført fra kl. 19 (med mindre dagen er hviledag). */
export function StrengthBlock({ date, active, doneHour = 19, children }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active) return;
    const check = () => {
      const now = osloParts(new Date());
      setDone(now.date > date || (now.date === date && now.hour >= doneHour));
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [date, active, doneHour]);
  return (
    <div className={`tb tb-str ${done ? "tb-done" : ""}`} title={done ? "Regnes som gjennomført etter kl. 19" : undefined}>
      {children}
    </div>
  );
}

/* =========================================================
   split-ordmerket med bevegelse
   Inngang: bokstavene spretter opp, i-en sparker prikken ut (360° i lufta).
   Deretter: prikken hopper av og til – aldri likt, og aldri mens du er i gang.
   Prinsipper: anticipation, squash & stretch bare ved kraft, ekte parabel,
   overlappende handling (snurren er ferdig før landing), aksjon–reaksjon
   (i-en gir etter), én dempet ettersvingning. Se brand guidelines.
   ========================================================= */
const E_OUT = "cubic-bezier(.2,.75,.3,1)";
const E_SOFT = "cubic-bezier(.45,0,.55,1)";
const E_RISE = "cubic-bezier(.33,.67,.67,1)"; // parabel opp
const E_FALL = "cubic-bezier(.33,0,.67,.33)"; // parabel ned

const run = (el, kf, duration, delay = 0) => el.animate(kf, { duration, delay, fill: "both" });
const clearAnims = (root) => root.getAnimations({ subtree: true }).forEach((a) => a.cancel());
const rnd = (a, b) => a + Math.random() * (b - a);

function logoIntro(logo) {
  const letters = [...logo.querySelectorAll(":scope > span:not(.li), .lii")];
  const dot = logo.querySelector(".ldot");
  letters.forEach((el, i) => {
    el.style.transformOrigin = "50% 100%";
    run(el, [
      { transform: "translateY(.5em) scale(.85,.35)", opacity: 0, easing: E_OUT },
      { transform: "translateY(-.1em) scale(.94,1.14)", opacity: 1, offset: 0.38, easing: E_SOFT },
      { transform: "translateY(.015em) scale(1.06,.93)", offset: 0.62, easing: E_SOFT },
      { transform: "translateY(0) scale(.99,1.02)", offset: 0.82, easing: E_SOFT },
      { transform: "translateY(0) scale(1,1)", opacity: 1 },
    ], 640, i * 45);
  });
  const L = 380, UP = 260, DOWN = 210, AIR = UP + DOWN, T = AIR + 300;
  run(dot, [
    { translate: "0 .3em", easing: E_RISE },
    { translate: "0 -.36em", offset: UP / AIR, easing: E_FALL },
    { translate: "0 0" },
  ], AIR, L);
  run(dot, [
    { rotate: "y 0deg", easing: "cubic-bezier(.25,.45,.45,1)" },
    { rotate: "y 360deg", offset: (AIR - 30) / AIR },
    { rotate: "y 360deg" },
  ], AIR, L);
  run(dot, [{ opacity: 0 }, { opacity: 1 }], 40, L);
  const last = run(dot, [
    { scale: ".2 .2", easing: E_OUT },
    { scale: ".9 1.15", offset: 90 / T, easing: E_SOFT },
    { scale: "1 1", offset: UP / T, easing: "ease-in" },
    { scale: ".92 1.1", offset: (AIR - 20) / T, easing: E_OUT },
    { scale: "1.18 .8", offset: (AIR + 50) / T, easing: E_SOFT },
    { scale: ".96 1.04", offset: (AIR + 160) / T, easing: E_SOFT },
    { scale: "1 1" },
  ], T, L);
  return last.finished;
}

function logoHop(logo, { h = 0.4, spin = 360, A = 170, settle = 320 } = {}) {
  const dot = logo.querySelector(".ldot");
  const i = logo.querySelector(".lii");
  i.style.transformOrigin = "50% 100%";
  // Lufttid ∝ √høyde; kraften i klem/strekk følger høyden
  const f = Math.sqrt(h / 0.4), k = Math.min(1.1, Math.max(0.45, h / 0.4));
  const UP = Math.round(250 * f), AIR = UP + Math.round(210 * f);
  const LAND = A + AIR, T = LAND + settle;
  const o = (ms) => Math.min(1, ms / T);
  const sq = (x, y) => `${(1 + (x - 1) * k).toFixed(3)} ${(1 + (y - 1) * k).toFixed(3)}`;

  run(dot, [
    { translate: "0 0", offset: 0 },
    { translate: "0 0", offset: o(A), easing: E_RISE },
    { translate: `0 -${h}em`, offset: o(A + UP), easing: E_FALL },
    { translate: "0 0", offset: o(LAND) },
    { translate: "0 0" },
  ], T);
  run(dot, [
    { rotate: "y 0deg", offset: 0 },
    { rotate: "y 0deg", offset: o(A + 30), easing: "cubic-bezier(.3,.35,.4,1)" },
    { rotate: `y ${spin}deg`, offset: o(LAND - 40) },
    { rotate: `y ${spin}deg` },
  ], T);
  const last = run(dot, [
    { scale: "1 1", easing: "cubic-bezier(.4,0,.6,1)" },
    { scale: sq(1.2, 0.72), offset: o(A), easing: E_OUT },
    { scale: sq(0.86, 1.22), offset: o(A + 70), easing: E_SOFT },
    { scale: "1 1", offset: o(A + UP), easing: "ease-in" },
    { scale: sq(0.93, 1.1), offset: o(LAND - 15), easing: E_OUT },
    { scale: sq(1.18, 0.8), offset: o(LAND + 50), easing: E_SOFT },
    { scale: sq(0.97, 1.03), offset: o(LAND + 170), easing: E_SOFT },
    { scale: "1 1" },
  ], T);
  run(i, [
    { scale: "1 1", easing: E_SOFT },
    { scale: sq(1, 0.965), offset: o(A), easing: E_OUT },
    { scale: sq(1, 1.015), offset: o(A + 70), easing: E_SOFT },
    { scale: "1 1", offset: o(A + 160) },
    { scale: "1 1", offset: o(LAND), easing: E_OUT },
    { scale: sq(1, 0.975), offset: o(LAND + 50), easing: E_SOFT },
    { scale: "1 1", offset: o(LAND + 180) },
    { scale: "1 1" },
  ], T);
  return last.finished;
}

/** Velger neste hopp: 60 % vanlig 360°, 25 % lite uten snurr, 15 % dobbelthopp. */
function pickHop(history) {
  let kind;
  do {
    const r = Math.random();
    kind = r < 0.6 ? "full" : r < 0.85 ? "small" : "double";
  } while (
    (kind === "double" && history.at(-1) === "double") ||
    (history.length >= 2 && history.slice(-2).every((k) => k === kind))
  );
  history.push(kind);
  if (history.length > 2) history.shift();
  const dir = Math.random() < 0.3 ? -1 : 1;
  if (kind === "small") return [{ h: rnd(0.14, 0.2), spin: 0, A: 120, settle: 240 }];
  if (kind === "double")
    return [{ h: rnd(0.12, 0.16), spin: 0, A: 130, settle: 0 }, { h: rnd(0.4, 0.46), spin: 360 * dir, A: 70 }];
  return [{ h: rnd(0.32, 0.44), spin: 360 * dir }];
}

export function SplitLogo({ href = "#idag" }) {
  const ref = useRef(null);
  useEffect(() => {
    const logo = ref.current;
    if (!logo) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !logo.animate) { logo.classList.remove("pre"); return; }

    let busy = true, timer, alive = true;
    const history = [];
    const done = () => { clearAnims(logo); busy = false; };
    const sequence = async (seq) => {
      if (busy) return;
      busy = true;
      try { for (const opts of seq) await logoHop(logo, opts); } catch {}
      if (alive) done();
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!document.hidden) sequence(pickHop(history));
        schedule();
      }, rnd(6000, 11000));
    };
    // Aktivitet utsetter neste hopp – den hopper ikke mens du holder på
    const nudge = () => { if (timer) schedule(); };
    const tap = () => { sequence([{}]); schedule(); };
    const events = ["scroll", "pointerdown", "keydown"];
    events.forEach((ev) => window.addEventListener(ev, nudge, { passive: true }));
    logo.addEventListener("click", tap);

    const start = () => {
      if (!alive) return;
      const p = logoIntro(logo);
      requestAnimationFrame(() => logo.classList.remove("pre"));
      p.then(() => { if (alive) { done(); schedule(); } }).catch(() => {});
    };
    (document.fonts?.ready ?? Promise.resolve()).then(start);

    return () => {
      alive = false;
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, nudge));
      logo.removeEventListener("click", tap);
      clearAnims(logo);
    };
  }, []);

  return (
    <a ref={ref} href={href} className="logo pre" aria-label="split – til toppen">
      <span aria-hidden>s</span>
      <span aria-hidden>p</span>
      <span className="lc" aria-hidden>l</span>
      <span className="li" aria-hidden>
        <span className="lii">i</span>
        <i className="ldot" />
      </span>
      <span className="lc" aria-hidden>t</span>
    </a>
  );
}
