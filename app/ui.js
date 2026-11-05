"use client";

import { useEffect, useRef, useState } from "react";

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
