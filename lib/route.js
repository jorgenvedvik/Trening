// Gjør en Strava-rute (summary_polyline) om til en SVG-sti.
// Personvern: de første og siste metrene klippes bort (start/slutt er ofte hjemme),
// og bare normaliserte tegneflate-koordinater sendes til nettleseren – aldri GPS-punkter.

const TRIM_M = 400;

/** Dekoder Googles polyline-format til [[lat, lng], …]. */
export function decodePolyline(str) {
  const pts = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let shift = 0, result = 0, b;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && i < str.length);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d;
      else lng += d;
    }
    pts.push([lat / 1e5, lng / 1e5]);
  }
  return pts;
}

function meters([a1, o1], [a2, o2]) {
  const R = 6371000, r = Math.PI / 180;
  const x = (o2 - o1) * r * Math.cos(((a1 + a2) / 2) * r);
  const y = (a2 - a1) * r;
  return Math.hypot(x, y) * R;
}

function trimStart(pts, m) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += meters(pts[i - 1], pts[i]);
    if (acc >= m) return pts.slice(i);
  }
  return [];
}

/**
 * Returnerer { d, w, h } – en sti tilpasset en boks på w×h, eller null hvis ruta er for kort.
 */
export function routePath(polyline, w = 320, h = 200, pad = 8) {
  if (!polyline) return null;
  let pts = decodePolyline(polyline);
  pts = trimStart(pts, TRIM_M);
  pts = trimStart(pts.reverse(), TRIM_M).reverse();
  if (pts.length < 4) return null;

  const midLat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xy = pts.map(([la, lo]) => [lo * k, -la]);
  const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const s = Math.min((w - pad * 2) / (maxX - minX || span), (h - pad * 2) / (maxY - minY || span));
  const ox = (w - (maxX - minX) * s) / 2, oy = (h - (maxY - minY) * s) / 2;

  const d = xy
    .map(([x, y], i) => `${i ? "L" : "M"}${((x - minX) * s + ox).toFixed(1)} ${((y - minY) * s + oy).toFixed(1)}`)
    .join("");
  const [ex, ey] = xy[xy.length - 1];
  return { d, w, h, end: [+((ex - minX) * s + ox).toFixed(1), +((ey - minY) * s + oy).toFixed(1)] };
}
