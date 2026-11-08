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
